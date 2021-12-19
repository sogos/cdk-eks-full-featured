import { NestedStack, NestedStackProps, Stack } from 'aws-cdk-lib';
import { IVpc, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as iam from 'aws-cdk-lib/aws-iam';
import { ImagePullPrincipalType } from 'aws-cdk-lib/aws-codebuild';


interface EksClusterStackProps extends NestedStackProps {
  vpc: IVpc,
  environment: string;
}


export class EksClusterStack extends NestedStack {

  readonly cluster: eks.Cluster;
  readonly fargateProfile: eks.FargateProfile;

  constructor(scope: Construct, id: string, props: EksClusterStackProps) {
    super(scope, id, props);


    const vpc = props.vpc;
    const environment = props?.environment;


    const masterRole = new iam.Role(this, 'masters-role', {
      roleName: `masters-${environment}`,
      assumedBy: new iam.AccountPrincipal(Stack.of(this).account),
    });




    this.cluster = new eks.Cluster(this, "eks-cluster", {
      version: eks.KubernetesVersion.V1_21,
      clusterName: `${environment}-cluster`,
      vpc: vpc,
      defaultCapacity: 2,
      mastersRole: masterRole,
      outputMastersRoleArn: true
    });

    this.fargateProfile = new eks.FargateProfile(this, "fargate-profile", {
      cluster: this.cluster,
      selectors: [{ namespace: "default" }, { namespace: `${environment}` }],
    });

    const eksMastersPolicy = new iam.Policy(this, 'eks-masters-policy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            "eks:DescribeCluster",
          ],
          resources: [
            this.cluster.clusterArn,
          ]
        })
      ]
    });
    masterRole.attachInlinePolicy(eksMastersPolicy);




  }
}
