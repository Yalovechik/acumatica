import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { VpcStack } from '../lib/vpc-stack.cdk';
import { AcumaticaStack } from '../lib/acumatica-stack';

// Initialize the CDK app
const app = new cdk.App();


const configFile = fs.readFileSync(path.join(__dirname, 'config.yaml'), 'utf8');
const config: any = yaml.load(configFile);

const env = {
  account: config.account,
  region: config.region,
};

// Deploy VPC Stack
const vpcStack = new VpcStack(app, 'VpcStack', {
  vpcName: config.vpcName,
  env,
});

// Check if tenant context is provided for deploying AcumaticaStack
const tenantName = app.node.tryGetContext('tenant');

if (tenantName) {

  // Find the tenant configuration
  const tenant = config.tenants.find((t: any) => t.name === tenantName);
  if (!tenant) {
    throw new Error(`Tenant ${tenantName} not found in the configuration`);
  }

  // Deploy Acumatica Stack
  new AcumaticaStack(app, `${tenant.name}Stack`, {
    clientName: tenant.name,
    dbName: tenant.dbName,
    instanceName: tenant.instanceName,
    acumaticaMsiUrl: `https://acumatica-builds.s3.amazonaws.com/builds/${tenant.acumaticaVersion}/AcumaticaERP/AcumaticaERPInstall.msi`,
    awsCliInstallerUrl: "https://awscli.amazonaws.com/AWSCLIV2.msi",
    env,
    vpcName: config.vpcName
  });
} else {
  console.log('No tenant context provided. Only VpcStack has been deployed.');
}
