import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface VpcStackProps extends cdk.StackProps {
    vpcName: string
}

export class VpcStack extends cdk.Stack {
  public readonly vpcId: string;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    const {vpcName} = props

    // Define the VPC
    const vpc = new ec2.Vpc(this, 'MyVpc', {
     vpcName,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Export the VPC ID
    this.vpcId = vpc.vpcId;

    new cdk.CfnOutput(this, 'VpcIdOutput', {
      value: vpc.vpcId,
      description: 'The ID of the VPC',
    });
  }
}
