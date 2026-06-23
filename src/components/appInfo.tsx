import styles from './appInfo.module.scss'

export default function AppInfo() {
  return (
    <form className={styles.appInfo}>
      <div>
        <p>MIT License</p>
        <p>
          <a href="https://github.com/kamyy/webgl-ray-tracer">Project @ GitHub</a>
        </p>
        <p>
          Copyright &copy; 2019&nbsp;
          <a href="mailto:kam.yin.yip@gmail.com">Kam Y Yip</a>
        </p>
      </div>
      <div>
        <p>
          <span className={styles.bold}>* Rotate</span> Left click + drag.
        </p>
        <p>
          <span className={styles.bold}>* Translate</span> Right click + drag. Or ctrl + left click + drag.
        </p>
        <p>
          <span className={styles.bold}>* Zoom In/Out</span> Mouse wheel. Or middle click + drag up/down.
        </p>
      </div>
    </form>
  )
}
