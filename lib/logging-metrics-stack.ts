import { CfnJson, NestedStack, NestedStackProps, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Cluster } from 'aws-cdk-lib/aws-eks';


interface LoggingMetricsStackProps extends NestedStackProps {
    cluster: Cluster,
    environment: string;
}


export class LoggingMetricsStack extends NestedStack {


    constructor(scope: Construct, id: string, props: LoggingMetricsStackProps) {
        super(scope, id, props);


        const sa = props.cluster.addServiceAccount('logging-metrics-sa-account', {
            namespace: "kube-system",
            name: "aws-for-fluent-bit"
        });

        sa.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'));
        sa.role.attachInlinePolicy(new iam.Policy(this, 'logging-metrics-sa-policy', {
            statements: [
                new iam.PolicyStatement({
                    actions: ["logs:putRetentionPolicy"],
                    resources: ["*"]
                })
            ]
        }));

        // https://artifacthub.io/packages/helm/aws/aws-for-fluent-bit
        new eks.HelmChart(this, "aws-for-fluent-bit-chart", {
            version: "0.1.11",
            release: "aws-for-fluent-bit",
            cluster: props.cluster,
            chart: "aws-for-fluent-bit",
            repository: "https://aws.github.io/eks-charts",
            namespace: "kube-system",
            createNamespace: false,
            values: {
                "image.repository": "public.ecr.aws/aws-observability/aws-for-fluent-bit",
                "image.tag": "2.21.5",
                "serviceAccount": {
                    "create": false,
                    "name": sa.serviceAccountName,
                },
                "cloudWatch": {
                    "enabled": true,
                    "region": Stack.of(this).region,
                    "logGroupName": "/aws/eks/eks-fluentbit-logs/" + props.cluster.clusterName + "/logs",
                },
                "firehose": {
                    "enabled": false,
                },
                "kinesis": {
                    "enabled": false,
                },
                "elasticsearch": {
                    "enabled": false,
                }
            },
        });

        // https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack
        new eks.HelmChart(this, "kube-prometheus-stack-chart", {
            version: "24.0.1",
            release: "kube-prometheus-stack",
            cluster: props.cluster,
            chart: "kube-prometheus-stack",
            repository: "https://prometheus-community.github.io/helm-charts",
            namespace: "prometheus",
            createNamespace: true,
            values: {

            },
        });


        // https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack>
        new eks.HelmChart(this, "aws-cloudwatch-metrics-chart", {
            version: "0.0.6",
            release: "aws-cloudwatch-metrics",
            cluster: props.cluster,
            chart: "aws-cloudwatch-metrics",
            repository: "https://aws.github.io/eks-charts",
            namespace: "kube-system",
            createNamespace: false,
            values: {
                "image.repository": "public.ecr.aws/cloudwatch-agent/cloudwatch-agent",
                "clusterName": props.cluster.clusterName,
                "serviceAccount": {
                    "create": false,
                    "name": sa.serviceAccountName,
                }
            },
        });


    }
}
