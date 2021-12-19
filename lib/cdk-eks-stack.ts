import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AlbControllerStack } from './alb-controller-stack';
import { AutoScalerStack } from './autoscaler-stack';
import { EksClusterStack } from './eks-cluster-stack';
import { LoggingMetricsStack } from './logging-metrics-stack';
import { SecretCsiStack } from './secret-csi-stack';
import { VpcStack } from './vpc-stack';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkEksStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const environment = 'dev';
    const vpcStack = new VpcStack(this, 'vpc');
    const clusterStack = new EksClusterStack(this, 'cluster', {
      vpc: vpcStack.vpc,
      environment: environment
    });
    new AlbControllerStack(this, 'alb-controller', {
      cluster: clusterStack.cluster,
      environment: environment

    });
    new LoggingMetricsStack(this, 'logging-metrics', {
      cluster: clusterStack.cluster,
      environment: environment
    }
    );
    new SecretCsiStack(this, 'csi-secrets', {
      cluster: clusterStack.cluster,
      environment: environment
    });
    new AutoScalerStack(this, 'autoscaler', {
      cluster: clusterStack.cluster,
      environment: environment
    });


  }
}
