import { Separator } from "./ui/separator";

function Header() {
  return (
    <header className="p-6 w-[900px]">
      <section className="flex justify-center items-center gap-12 m-14">
        <div className="flex flex-[2] flex-col gap-3 items-center">
          <img
            src="ubuntu.png"
            alt="Linux, Windows and Mac"
            className="h-20 w-20"
          />
          <h2 className="text-xl font-bold">Cloud Desktop on Demand</h2>
        </div>
        <div className="flex-[3]">
          <p>
            Browser-based access to a secure and customized work environment.
            Work from any location on any device.
          </p>
        </div>
      </section>
      <Separator />
      <section className="flex justify-center items-center gap-12 m-14">
        <div className="flex-[3]">
          <p>
            Experience seamless browsing with a cloud-based browser,
            customizable and accessible from any device, offering security and
            flexibility wherever you are.
          </p>
        </div>
        <div className="flex flex-[2] flex-col gap-3 items-center">
          <img
            src="chrome.png"
            alt="Linux, Windows and Mac"
            className="h-20 w-20"
          />
          <h2 className="text-xl font-bold">Cloud Browser on Demand</h2>
        </div>
      </section>
    </header>
  );
}

export default Header;
