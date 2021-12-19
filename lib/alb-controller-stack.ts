import { CfnJson, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { IVpc, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Cluster } from 'aws-cdk-lib/aws-eks';
import { Policy, PolicyDocument } from 'aws-cdk-lib/aws-iam';
const albControllerIAMPolicy = require('../alb-controller-iam-policy.json');


interface ALBControllerStackProps extends NestedStackProps {
    cluster: Cluster,
    environment: string;
}


export class AlbControllerStack extends NestedStack {


    constructor(scope: Construct, id: string, props: ALBControllerStackProps) {
        super(scope, id, props);


        const conditions = new CfnJson(this, "ALBConditionJson", {
            value: {
                [`${props.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:aud`]:
                    "sts.amazonaws.com",
                [`${props.cluster.openIdConnectProvider.openIdConnectProviderIssuer}:sub`]:
                    "system:serviceaccount:kube-system:ebs-csi-controller-sa",
            },
        });

        const iam_alb_oidc = new iam.FederatedPrincipal(
            props.cluster.openIdConnectProvider.openIdConnectProviderArn,
            {},
            "sts:AssumeRoleWithWebIdentity"
        ).withConditions({
            StringEquals: conditions,
        });

        const alb_role = new iam.Role(this, "alb-controller-role", {
            roleName: "alb-controller-role-" + props.environment,
            assumedBy: iam_alb_oidc,
        });


        const albControllerPolicyDocument = PolicyDocument.fromJson(albControllerIAMPolicy);
        const policy = new Policy(this, 'alb-controller-policy-controller', {
            document: albControllerPolicyDocument,
        });
        alb_role.attachInlinePolicy(policy);


        new eks.HelmChart(this, "cert-manager", {
            version: "v1.6.1",
            release: "cert-manager",
            cluster: props.cluster,
            chart: "cert-manager",
            repository: "https://charts.jetstack.io",
            namespace: "cert-manager",
            createNamespace: true,
            values: {
                installCRDs: true,
            },
        });



        new eks.HelmChart(this, "alb-load-balancer-controller-chart", {
            version: "1.3.3",
            release: "aws-load-balancer-controller",
            cluster: props.cluster,
            chart: "aws-load-balancer-controller",
            repository: "https://aws.github.io/eks-charts",
            namespace: "kube-system",
            createNamespace: false,
            values: {
                clusterName: props.cluster.clusterName,
                "serviceAccount.create": "true",
                "serviceAccount.name": "aws-load-balancer-controller",
                "serviceAccount.annotations": {
                    "eks.amazonaws.com/role-arn": alb_role.roleArn,
                }

            },
        });



    }
}
