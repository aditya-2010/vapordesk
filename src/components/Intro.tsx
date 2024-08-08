import FeatureCard from "./FeatureCard";

function Intro() {
  return (
    <section className="relative mx-auto flex flex-col items-center">
      <img
        src="hero_bg.jpg"
        alt="VaporDesk Hero background Image"
        className="absolute dark:opacity-50"
      />
      <h1 className="relative w-[70%] text-white text-center my-24 text-6xl">
        Launch secure, temporary cloud desktops and browsers anytime, anywhere.
      </h1>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background"></div>
      <FeatureCard />
    </section>
  );
}

export default Intro;
