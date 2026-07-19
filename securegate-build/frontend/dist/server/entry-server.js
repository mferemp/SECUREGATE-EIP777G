import { jsx } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
function render() {
  return renderToString(
    /* @__PURE__ */ jsx(
      "div",
      {
        "data-surf-placeholder": true,
        style: {
          minHeight: "100vh",
          background: "#ffffff"
        }
      }
    )
  );
}
export {
  render
};
