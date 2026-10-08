# Portfolio

The design and development portfolio of Brianna Godfrey, a Charlotte product designer who also builds what she designs.

**Live site:** https://briakgodfrey.github.io/portfolio/

## Case studies

| Project | What it shows |
| --- | --- |
| [PaySupport](work/paysupport.html) | A full-stack payment support dashboard and API, with security and accessibility designed in |
| [Weekflow](work/weekflow.html) | A shipped, privacy-first weekly planner, designed and built end to end |
| [Charlotte Ironclad FC](work/ironclad-fc.html) | A broadcast-inspired sports marketing site, built with Sass |
| [Palette](work/palette.html) | A mobile app concept covering a full discover, save and organize loop |
| [Helix & Hue Studio](work/helix-hue.html) | A UX case study and responsive site for a curly hair stylist |

Each case study has a Design / Code switch at the top that flips between the finished screen and real code from that project's repo. The home page opens with a pinned "design to code" story that turns one button into its spec and then its CSS as you scroll.

## Built with

Plain HTML, CSS and a small amount of JavaScript. No framework or build step.

```
index.html        home page: intro, work, about, contact
work/             one page per case study
css/styles.css    all styles, with light and dark themes and motion
js/main.js        theme switch, scroll motion, Design / Code tabs, contents list
images/           project screenshots
```

To run it locally, open `index.html` in a browser.

## Accessibility

- Skip link, semantic landmarks and visible focus styles
- Keyboard-accessible tabs (arrow keys, Home, End)
- Text colors meet WCAG AA contrast in both light and dark themes
- Light by default with an optional dark theme that is remembered per visitor
- All motion turns off when a visitor has `prefers-reduced-motion` set
