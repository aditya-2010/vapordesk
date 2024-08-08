import { _InstanceType } from "@aws-sdk/client-ec2";

export const awsRegion = "ap-south-1";

export const ec2Instances: _InstanceType[] = [
  "t2.micro",
  "t2.small",
  "t2.large",
];

// image-name: display name
export const osList = {
  "ubuntu-focal-desktop": "Ubuntu 22.04",
  "centos-7-desktop": "CentOS 7",
  "core-kali-rolling": "Kali Linux",
};

// image-name: display name
export const browserList = {
  chrome: "Chrome",
  brave: "Brave",
  firefox: "Firefox",
  vivaldi: "Vivaldi",
};
