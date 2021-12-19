import { CfnJson, NestedStack, NestedStackProps, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Cluster, KubernetesManifest } from 'aws-cdk-lib/aws-eks';


interface AutoScalerStackProps extends NestedStackProps {
    cluster: Cluster,
    environment: string;
}


export class AutoScalerStack extends NestedStack {


    constructor(scope: Construct, id: string, props: AutoScalerStackProps) {
        super(scope, id, props);


        // https://docs.aws.amazon.com/eks/latest/userguide/autoscaling.html
        const autoscalerPolicy = new iam.Policy(this, 'autoscaler-policy', {
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        "autoscaling:DescribeAutoScalingGroups",
                        "autoscaling:DescribeAutoScalingInstances",
                        "autoscaling:DescribeLaunchConfigurations",
                        "autoscaling:DescribeTags",
                        "autoscaling:SetDesiredCapacity",
                        "autoscaling:TerminateInstanceInAutoScalingGroup",
                        "ec2:DescribeLaunchTemplateVersions"
                    ],
                    resources: ["*"],
                    effect: iam.Effect.ALLOW
                })
            ]
        });

        const sa = props.cluster.addServiceAccount("autoscaler-sa-account", {
            namespace: "kube-system",
            name: "cluster-autoscaler"
        });

        sa.role.attachInlinePolicy(autoscalerPolicy);

        new eks.HelmChart(this, "cluster-autoscaler-chart", {
            version: "9.10.9",
            release: "cluster-autoscaler",
            cluster: props.cluster,
            chart: "cluster-autoscaler",
            repository: "https://kubernetes.github.io/autoscaler",
            namespace: "kube-system",
            createNamespace: false,
            values: {
                autoDiscovery: {
                    clusterName: props.cluster.clusterName,
                },
                "rbac": {
                    "create": true,
                    "serviceAccount": {
                        "create": false,
                        "name": sa.serviceAccountName
                    }
                },
                replicaCount: 2,
                serviceMonitor: {
                    enabled: true,
                    namespace: "prometheus"
                }
            },
        });


    }
}
