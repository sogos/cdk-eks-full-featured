import { NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class VpcStack extends NestedStack {

    readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

        this.vpc = new Vpc(this, "vpc", {
            cidr: "10.124.0.0/16",
            maxAzs: 3,
            enableDnsSupport: true,
            natGateways: 1,
            subnetConfiguration: [
                {
                    name: "ECS-Public-Subnet",
                    subnetType: SubnetType.PUBLIC
                },
                {
                    name: "ECS-Nodes-Subnet",
                    subnetType: SubnetType.PRIVATE_WITH_NAT
                }
            ]

        })

  }
}
