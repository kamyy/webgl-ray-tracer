import styles from './ApplicationInfo.module.scss';

export default function ApplicationInfo() {
  return (
    <form className={styles.applicationInfo}>
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
          <span className={styles.bold}>* Dolly In/Out</span> Left + right click + drag. Or shift + left click + drag.
        </p>
      </div>
    </form>
  );
}
