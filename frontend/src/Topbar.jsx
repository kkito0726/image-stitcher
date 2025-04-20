import "./Topbar.css";

export const Topbar = () => {
  return (
    <div class="navbar">
      <a href="/">
        <div class="logo">
          <span class="logo-text">
            Image <span class="logo-highlight">Stitcher</span>
          </span>
        </div>
      </a>
      <div class="org-name">
        LaR<span class="logo-highlight">Code</span>
      </div>
    </div>
  );
};
