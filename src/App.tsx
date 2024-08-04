import { ChangeEvent, useCallback, useEffect, useState } from "react";
import {
  checkDockerStatus,
  checkInstanceState,
  launchEC2Instance,
  terminateInstance,
} from "./aws";
import { formatTime } from "./lib/formatTime";
import { _InstanceType } from "@aws-sdk/client-ec2";
import "./globals.css";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  // CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import Header from "./components/Header";
import { Input } from "./components/ui/input";
import {
  CircleCheckBig,
  CircleStop,
  ExternalLink,
  LoaderCircle,
  Rocket,
  Skull,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import Navbar from "./components/Navbar";

const INSTANCE_TERMINATION_TIME = 10; // in minutes

const App = () => {
  const [instanceType, setInstanceType] = useState<_InstanceType>();
  const [app, setApp] = useState<string>();
  const [password, setPassword] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState("");
  const [ipAddress, setIpAddress] = useState<string | null>("");
  const [id, setId] = useState<string>("");
  const [containerReady, setContainerReady] = useState<boolean>(false);
  const [startPolling, setStartPolling] = useState<boolean>(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add("dark");
    return;
  }, []);

  const handleCheckDockerStatus = useCallback(async () => {
    if (!id) {
      console.error("handleCheckDockerStatus: Instance ID is not available.");
      return;
    }

    try {
      const instanceState = await checkInstanceState(id);
      if (instanceState !== "running") {
        console.error(
          `handleCheckDockerStatus: Instance is not in running state. Current state: ${instanceState}`
        );
        return;
      }
      const status = await checkDockerStatus(id);
      return status;
    } catch (error) {
      console.error("Error checking Docker status:", error);
    }
  }, [id]);

  const handleTerminateInstance = useCallback(async () => {
    if (!id) {
      console.error("handleTerminateInstance: Instance ID is not available.");
      return;
    }

    setLoading(true);
    try {
      await terminateInstance(id);
      setId("");
      setIpAddress(null);
      setMessage("Cloud desktop terminated");
      setContainerReady(false);
      setRemainingTime(null);
      setPassword("");
    } catch (error) {
      console.error(
        "handleTerminateInstance: Error terminating instance:",
        error
      );
      // alert("Failed to terminate instance");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Polling to check docker container status
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function start() {
      const status = await handleCheckDockerStatus();
      if (status) {
        setStartPolling(false);
        setContainerReady(true);
        setLoading(false);
        setMessage("Cloud desktop is ready!");
        window.open(`https://${ipAddress}:6901`, "_blank", "popup");
        startTerminationTimer();
        return;
      }
    }
    if (startPolling) {
      start();
      interval = setInterval(start, 5000);
    }
    return () => clearInterval(interval);
  }, [startPolling, ipAddress, id, handleCheckDockerStatus]);

  // Instance termination timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    if (remainingTime !== null && remainingTime > 0) {
      timer = setInterval(() => {
        setRemainingTime((prevTime) => prevTime! - 1);
      }, 1000);
    } else if (remainingTime === 0) {
      handleTerminateInstance();
      setRemainingTime(null);
      setLoading(false);
    }
    return () => clearInterval(timer);
  }, [remainingTime, id, handleTerminateInstance]);

  // Function to handle instance termination after INSTANCE_TERMINATION_TIME minutes
  const startTerminationTimer = () => {
    setRemainingTime(INSTANCE_TERMINATION_TIME * 60); // in seconds
  };

  const handleLaunchInstance = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setLoading(true);
    setStartPolling(false);
    setContainerReady(false);
    setMessage("Configuring resources...");

    try {
      const { instanceId, publicIpAddress } = await launchEC2Instance(
        instanceType!,
        app!,
        password!
      );
      if (instanceId === null) {
        setMessage("Maximum number exceeded, please try again later");
        return;
      }
      setId(instanceId);
      setIpAddress(publicIpAddress);
      setMessage("Launching your cloud desktop... This might take upto 5 min");
      setPassword("");
      setStartPolling(true);
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`);
    } finally {
      // setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="w-[1280px] mx-auto flex flex-col items-center">
        {/* <h1>Welcome to InstaVM</h1> */}
        <h1 className="w-[70%] text-center my-24 font-medium">
          Launch secure, temporary cloud desktops and browsers anytime,
          anywhere.
        </h1>
        <Header />
      </main>

      <form
        onSubmit={handleLaunchInstance}
        className="w-full p-10 flex flex-col gap-4 items-center"
      >
        <div className="flex gap-3 w-[600px]">
          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Get started now!</CardTitle>
              {/* <CardDescription>Card Description</CardDescription> */}
            </CardHeader>
            <CardContent>
              <label
                className="flex gap-5 justify-between items-center mb-2"
                htmlFor="instance-selection"
              >
                <p>Choose Compute Type:</p>
                <Select
                  onValueChange={(val) => setInstanceType(val as _InstanceType)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select an instance type" />
                  </SelectTrigger>
                  <SelectContent className="" id="instance-selection">
                    <SelectItem value="t2.micro">t2.micro</SelectItem>
                    <SelectItem value="t2.small">t2.small</SelectItem>
                    <SelectItem value="t2.large">t2.large</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {instanceType === "t2.micro" && (
                <p className="text-right text-sm opacity-70 m-3">
                  vCPU: 1 | RAM: 1GB
                </p>
              )}
              {instanceType === "t2.small" && (
                <p className="text-right text-sm opacity-70 m-3">
                  vCPU: 1 | RAM: 2GB
                </p>
              )}
              {instanceType === "t2.large" && (
                <p className="text-right text-sm opacity-70 m-3">
                  vCPU: 2 | RAM: 8GB
                </p>
              )}
              <label
                className="flex gap-5 justify-between items-center mb-2"
                htmlFor="instance-selection"
              >
                Choose Desktop or Browser:
                <Select onValueChange={(val) => setApp(val)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Operating System</SelectLabel>
                      <SelectItem value="ubuntu-focal-desktop">
                        Ubuntu 20.04
                      </SelectItem>
                      <SelectItem value="centos-7-desktop">CentOS 7</SelectItem>
                      <SelectItem value="core-kali-rolling">
                        Kali Linux
                      </SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Browser</SelectLabel>
                      <SelectItem value="chrome">Chrome</SelectItem>
                      <SelectItem value="vivaldi">Vivaldi</SelectItem>
                      <SelectItem value="brave">Brave</SelectItem>
                      <SelectItem value="firefox">Firefox</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
              <label
                className="flex gap-5 justify-between items-center"
                htmlFor="instance-selection"
              >
                Set password (8 char. min)
                <Input
                  type="password"
                  placeholder="Password goes here..."
                  className="w-56"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                />
              </label>
            </CardContent>
            <CardFooter>
              {/* <p>[Details of the selected items]</p> */}
              <Button
                className="mb-5 w-full"
                variant="default"
                type="submit"
                disabled={
                  loading ||
                  startPolling ||
                  !instanceType ||
                  !app ||
                  password.length < 8 ||
                  containerReady
                }
              >
                Launch <Rocket height={15} />
                {/* {loading ? "Launching..." : "Launch EC2 Instance"} */}
              </Button>
            </CardFooter>
            {message && (
              <Alert className="text-left mb-4 w-[600px] mx-4">
                {loading && (
                  <LoaderCircle className="animate-spin" height={20} />
                )}
                {containerReady && <CircleCheckBig height={20} color="green" />}
                {message.includes("terminated") && (
                  <CircleStop height={20} color="red" />
                )}
                <AlertTitle className="mb-4">{message}</AlertTitle>
                <AlertDescription>
                  {containerReady && (
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        className="w-48 text-lg"
                        variant="secondary"
                        onClick={() =>
                          window.open(
                            `https://${ipAddress}:6901`,
                            "_blank",
                            "popup"
                          )
                        }
                      >
                        Open <ExternalLink height={20} />
                      </Button>
                      <Button
                        type="button"
                        className="w-48 text-lg"
                        variant="destructive"
                        onClick={handleTerminateInstance}
                      >
                        Terminate <Skull height={20} />
                      </Button>
                    </div>
                  )}
                  {remainingTime !== null && (
                    <p className="text-lg mt-4">
                      Time until auto-termination:{" "}
                      <span className="font-bold">
                        {formatTime(remainingTime)}{" "}
                      </span>
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </Card>
        </div>
      </form>

      {/* {message && <p>{message}</p>} */}
    </>
  );
};

export default App;
