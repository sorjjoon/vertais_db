import sanitizeHtml from "sanitize-html";
import { DOMAIN_NAME } from "../server/constant";
import { Nullish } from "../types";

const sanitizeOpts = {
  allowedAttributes: {
    img: ["src", "alt"],
  },
  allowedSchemes: ["data"],
  exclusiveFilter: (frame: any) => frame.attribs["data-js"] === "mathEditor",
  allowedTags: ["div", "p", "img", "br", "span"],
};

export function sanitize(html: string | Nullish) {
  if (!html) {
    return "";
  }
  return sanitizeHtml(convertLinksToRelative(html), sanitizeOpts);
}

function convertLinksToRelative(html: string) {
  return html.replace(new RegExp(DOMAIN_NAME, "g"), "");
}
