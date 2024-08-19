````markdown
## Prerequisites

- **AWS CLI**: You need to have the AWS CLI installed. Follow the instructions here: [Installing the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
- **IAM User**: Ensure you have an IAM user with admin privileges to deploy the stack.

### Setup

1. **Configure AWS CLI**: Run the following command to configure your AWS CLI credentials:

   ```bash
   aws configure
   ```
````

## Deploy VPC Stack

If you are deploying for the first time, bootstrap the environment with:

```bash
cdk bootstrap aws://<accountnumber>/<region>
```

Then, deploy the VPC stack:

```bash
cdk deploy VpcStack
```

## Deploy the Main Stack

Deploy the client stack by specifying the client name from the `config.yml` file:

```bash
cdk deploy <client>Stack -c tenant=<client>
```

**Note**: The `<client>` should correspond to the `-name` field in the `config.yml` file. For example:

```bash
cdk deploy client1Stack -c tenant=client1
```

### Post-Deployment

After deploying the stack, you will receive an output with a Public DNS like:

```
ec2-18-201-38-39.eu-west-1.compute.amazonaws.com/
```

To access the site, append the `instanceName` from the `config.yaml` file:

```
ec2-18-201-38-39.eu-west-1.compute.amazonaws.com/AcumaticaInstance
```

Please be aware that the deployment process will take some time to complete. It may take approximately 30-40 minutes for the user data script to execute fully and the result to be available.

THe default username - admin, pass - setup

```

```

It has been tested with the following:
24.1/24.109.0016
23.2/23.210.0017
