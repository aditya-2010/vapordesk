import LaunchForm from "@/components/LaunchForm";
import Navbar from "@/components/Navbar";
import Intro from "./components/Intro";

const App = () => {
  return (
    <div className="my-0 mx-auto">
      <Navbar />
      <Intro />
      <LaunchForm />
    </div>
  );
};

export default App;
