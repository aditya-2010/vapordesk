import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  TerminateInstancesCommand,
  RunInstancesCommandInput,
  _InstanceType,
  DescribeInstancesCommandInput,
} from "@aws-sdk/client-ec2";
import {
  GetCommandInvocationCommand,
  SendCommandCommand,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { Buffer } from "buffer";

const MAX_INSTANCES = 2;

const client = new EC2Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: import.meta.env.VITE_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_APP_AWS_SECRET_ACCESS_KEY,
  },
});

const ssmClient = new SSMClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: import.meta.env.VITE_APP_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_APP_AWS_SECRET_ACCESS_KEY,
  },
});

interface LaunchResult {
  instanceId: string;
  publicIpAddress: string | null;
}

const getUserData = (app: string, passw: string) => {
  return `#!/bin/bash
    sudo yum update -y
    # Install docker
    sudo yum install docker -y
    sudo service docker start
    sudo usermod -a -G docker ec2-user
    # Install amazon ssm agent
    sudo yum install -y amazon-ssm-agent
    sudo systemctl enable amazon-ssm-agent
    sudo systemctl start amazon-ssm-agent
    # wait for docker to run 
    # sleep 30
    # pull and run image
    sudo docker pull kasmweb/${app}:1.14.0
    # Wait until the image is fully pulled
    imagePulled=false
    while [ $imagePulled == false ]; do
        if sudo docker images | grep -q 'kasmweb/${app}'; then
            imagePulled=true
        else
            sleep 5
        fi
    done
    # run the container 
    sudo docker run --rm -d --shm-size=512m -p 6901:6901 -e VNC_PW=${passw} kasmweb/${app}:1.14.0
    sleep 30 
    if sudo docker ps | grep -q kasmweb/${app}; then
        echo "docker_container_running" > /home/ec2-user/docker_status.txt
    else
        echo "docker_container_not_running" > /home/ec2-user/docker_status.txt
    fi`;
};

export const launchEC2Instance = async (
  instanceType: _InstanceType,
  app: string,
  password: string
): Promise<LaunchResult> => {
  // Check the number of running instances
  const runningInstances = await getRunningInstances();
  if (runningInstances >= MAX_INSTANCES) {
    return {
      instanceId: "",
      publicIpAddress: null,
    };
  }

  const userData = getUserData(app, password);
  const userDataScript = Buffer.from(userData).toString("base64");
  const params: RunInstancesCommandInput = {
    ImageId: "ami-0ec0e125bb6c6e8ec",
    InstanceType: instanceType,
    MinCount: 1,
    MaxCount: 1,
    KeyName: import.meta.env.VITE_KEY_PAIR,
    UserData: userDataScript,
    SecurityGroupIds: ["sg-05c8e88744d23b1eb"],
    IamInstanceProfile: {
      Name: "EC2SSMRole",
    },
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          {
            Key: "Name",
            Value: "MyEC2Instance",
          },
        ],
      },
    ],
    BlockDeviceMappings: [
      {
        DeviceName: "/dev/xvda",
        Ebs: {
          VolumeSize: 20,
        },
      },
    ],
  };

  try {
    // Launch instance
    const command = new RunInstancesCommand(params);
    const data = await client.send(command);
    const instanceId = data.Instances![0].InstanceId!;

    // Wait for the instance to be in a running state
    await waitForInstanceRunning(instanceId);

    // Get IP address of running instance
    const describeParams: DescribeInstancesCommandInput = {
      InstanceIds: [instanceId!],
    };
    const describeCommand = new DescribeInstancesCommand(describeParams);
    const describeData = await client.send(describeCommand);
    const publicIpAddress =
      describeData.Reservations![0].Instances![0].PublicIpAddress;

    if (publicIpAddress === undefined) {
      throw new Error("Public IP address not available");
    }

    return {
      instanceId,
      publicIpAddress,
    };
  } catch (err) {
    console.log(err);
    throw new Error(`Error launching EC2 instance: ${(err as Error).message}`);
  }
};

// Function to wait until the instance is running
const waitForInstanceRunning = async (instanceId: string) => {
  let isRunning = false;
  while (!isRunning) {
    const describeParams = {
      InstanceIds: [instanceId],
    };
    const describeCommand = new DescribeInstancesCommand(describeParams);
    const describeData = await client.send(describeCommand);
    const instanceState =
      describeData.Reservations![0].Instances![0].State!.Name;
    if (instanceState === "running") {
      isRunning = true;
    } else {
      // Wait for a few seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

// Function to check status of docker container
export const checkDockerStatus = async (instanceId: string) => {
  const commandParams = {
    DocumentName: "AWS-RunShellScript",
    InstanceIds: [instanceId],
    Parameters: {
      commands: ["sudo docker ps"],
    },
  };

  try {
    const command = new SendCommandCommand(commandParams);
    const data = await ssmClient.send(command);
    const commandId = data.Command!.CommandId;

    // Poll until the command is successful or times out
    let status = "Pending";
    while (status === "Pending" || status === "InProgress") {
      const invocationParams = {
        CommandId: commandId,
        InstanceId: instanceId,
      };
      const invocationCommand = new GetCommandInvocationCommand(
        invocationParams
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const invocationData = await ssmClient.send(invocationCommand);
      status = invocationData.Status!;
      if (status === "Success") {
        return invocationData!.StandardOutputContent!.includes("kasmweb");
      }
      // await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    return false;
  } catch (err) {
    throw new Error(
      `Error checking docker container status: ${(err as Error).message}`
    );
  }
};

// Function to check instance state
export const checkInstanceState = async (instanceId: string) => {
  const commandParams = {
    InstanceIds: [instanceId],
  };

  try {
    const command = new DescribeInstancesCommand(commandParams);
    const data = await client.send(command);
    const instanceState = data!.Reservations![0].Instances![0].State!.Name;
    // console.log(instanceState);
    return instanceState;
  } catch (err) {
    throw new Error(`Error cheching instance state: ${(err as Error).message}`);
  }
};

// Function to terminate an EC2 instance
export const terminateInstance = async (instanceId: string) => {
  const params = {
    InstanceIds: [instanceId],
  };

  try {
    const command = new TerminateInstancesCommand(params);
    const data = await client.send(command);
    return data;
  } catch (err) {
    throw new Error(`Error terminating instance: ${(err as Error).message}`);
  }
};

// Function to get the number of running instances
const getRunningInstances = async () => {
  const params = {
    Filters: [
      {
        Name: "instance-state-name",
        Values: ["running"],
      },
    ],
  };

  const command = new DescribeInstancesCommand(params);
  const data = await client.send(command);

  let runningInstances = 0;
  data!.Reservations!.forEach((reservation) => {
    runningInstances += reservation!.Instances!.length;
  });

  return runningInstances;
};
