export default function AppInfo() {
  return (
    <form className="flex justify-evenly p-8 text-center">
      <div>
        <p className="my-4">MIT License</p>
        <p className="my-4">
          <a className="text-[#0000ee] underline" href="https://github.com/kamyy/webgl-ray-tracer">
            Project @ GitHub
          </a>
        </p>
        <p className="my-4">
          Copyright &copy; 2019&nbsp;
          <a className="text-[#0000ee] underline" href="mailto:kam.yin.yip@gmail.com">
            Kam Y Yip
          </a>
        </p>
      </div>
      <div>
        <p className="my-4">
          <span className="font-bold">* Rotate</span> Left click + drag.
        </p>
        <p className="my-4">
          <span className="font-bold">* Translate</span> Right click + drag. Or ctrl + left click + drag.
        </p>
        <p className="my-4">
          <span className="font-bold">* Zoom In/Out</span> Mouse wheel. Or middle click + drag up/down.
        </p>
      </div>
    </form>
  )
}
