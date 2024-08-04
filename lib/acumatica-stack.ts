import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';
import * as path from 'path';
import { KeyPair } from 'cdk-ec2-key-pair';
import { CfnOutput } from 'aws-cdk-lib';

interface AcumaticaStackProps extends cdk.StackProps {
  clientName: string;
  dbName: string;
  instanceName: string;
  acumaticaMsiUrl: string;
  awsCliInstallerUrl: string;
  vpcName: string
}

export class AcumaticaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AcumaticaStackProps) {
    super(scope, id, props);

    const { clientName, dbName, instanceName, acumaticaMsiUrl, awsCliInstallerUrl, vpcName } = props;

    // Import the VPC
    const vpc = ec2.Vpc.fromLookup(this, 'ImportedVpc', {
      vpcName
    });

    const paramsObject = {
      dbName,
      instanceName,
      acumaticaMsiUrl,
      awsCliInstallerUrl
    };

    const paramsObjString = JSON.stringify(paramsObject);
    const paramName = `${clientName}-${instanceName}-param`;

    // Parameter Store
    const ssmParam = new ssm.StringParameter(this, `${clientName}-Parameter`, {
      allowedPattern: '.*',
      description: 'Parameter for running EC2',
      parameterName: paramName,
      stringValue: paramsObjString,
      tier: ssm.ParameterTier.ADVANCED,
    });

    // Key Pair
    const key = new KeyPair(this, `${clientName}-KeyPair`, {
      keyPairName: `${clientName}-acumatica`,
      description: 'Key pair for EC2',
      storePublicKey: true, 
    });

    // Windows Image
    const windowsImage = new ec2.WindowsImage(ec2.WindowsVersion.WINDOWS_SERVER_2022_ENGLISH_FULL_BASE);

    // EC2 Security Group
    const ec2SecurityGroup = new ec2.SecurityGroup(this, `${clientName}-Ec2SecurityGroup`, {
      vpc,
      allowAllOutbound: true
    });

    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3389),
      'Allow RDP access'
    );

    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP access'
    );

    ec2SecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS access'
    );

    // RDS Security Group
    const rdsSecurityGroup = new ec2.SecurityGroup(this, `${clientName}-SecurityGroupRDS`, {
      vpc,
    });

    rdsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(1433),
    );

    rdsSecurityGroup.addIngressRule(
      ec2.SecurityGroup.fromSecurityGroupId(this, 'Ec2SecurityGroupId', ec2SecurityGroup.securityGroupId),
      ec2.Port.tcp(1433),
      "Allow MySQL access from EC2",
    );

    // RDS Database Instance
    const dbInstance = new rds.DatabaseInstance(this, `${clientName}-DBInstance`, {
      vpc,
      instanceIdentifier: `${clientName}-db-acumatica-new`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, 
      },
      licenseModel: rds.LicenseModel.LICENSE_INCLUDED,
      engine: rds.DatabaseInstanceEngine.sqlServerWeb({
        version: rds.SqlServerEngineVersion.VER_16_00_4095_4_V1,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.M5,
        ec2.InstanceSize.LARGE,
      ),
      credentials: rds.Credentials.fromGeneratedSecret("admin"),
      multiAz: false,
      allocatedStorage: 100,
      maxAllocatedStorage: 200,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(0),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: true,
      securityGroups: [rdsSecurityGroup],
      publiclyAccessible: true,
    });

    // IAM Role for SSM
    const ssmRole = new iam.Role(this, `${clientName}-SsmRole`, {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    ssmRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    ssmRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*'],
    }));

    ssmRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters'
      ],
      resources: [ssmParam.parameterArn], 
    }));

    // User Data Script
    const userDataScript = readFileSync(path.join(__dirname, 'user-data.ps1'), 'utf8')
      .replace(/{SECRET_NAME}/g, dbInstance.secret?.secretName || "")
      .replace(/{SSM_NAME}/g, paramName);

    const userData = ec2.UserData.forWindows();
    userData.addCommands(userDataScript);

    // EC2 Instance
    const ec2Instance = new ec2.Instance(this, `${clientName}-AcumaticaInstance`, {
      instanceName: `${clientName}-acumatica-windows`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.M3, ec2.InstanceSize.LARGE),
      machineImage: windowsImage,
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroup: ec2SecurityGroup,
      role: ssmRole,
      keyPair: key,
      userData,
    });

    key.grantReadOnPrivateKey(ssmRole);
    key.grantReadOnPublicKey(ssmRole);

    ec2Instance.node.addDependency(dbInstance);

    // Outputs
    new CfnOutput(this, `${clientName}-InstancePublicDns`, {
      value: ec2Instance.instancePublicDnsName,
      description: 'Public DNS',
    });
  }
}
