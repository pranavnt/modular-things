import { html, svg, render } from "https://unpkg.com/lit-html@2.6.1/lit-html.js";
import { flattenSVG } from 'https://cdn.jsdelivr.net/npm/flatten-svg@0.3.0/+esm'

/*
TODO

- differentiate by color

*/


const state = {
  position: {
    x: 0,
    y: 0,
  },
  shapes: {},
  transformations: {},
  strokes: {},
  selectedShapes: new Set(),
  workArea: {
    width: 200,
    height: 500,
  },
  transforming: false,
  panZoomFuncs: null,
};

const view = (state) => html`
  <style>
    .interface-container {
      width: 100%;
      height: 100%;
      min-height: 100%;
      display: flex;
      overflow: hidden;
    }

    .control-panel {
      width: 300px;
      min-width: 300px;
      background: #fff7f7;
      border-bottom: 1px solid black;
      padding: 10px;
      height: 100%;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .button {
      border: 1px solid black;
      width: 50%;
      padding: 5px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: grey;
      color: white;
    }

    .button:hover {
      opacity: .8;
      cursor: pointer;
    }

    .button-container {
      width: 100%;
      display: flex;
      justify-content: center;
      padding-top: 10px;
    }

    .minor-button {
      transform: scale(.7);
    }

    .x-y {
      display: flex;
      width: 100%;
      height: 30px;
    }

    .x-y > * {
      flex: 1;
    }

    .svg-viewer {
      flex: 1;
      background: white;
      border-left: 1px solid black;
      border-bottom: 1px solid black;
      transform: scale(1, -1);
    }

    .jobs {
      height: 80%;
      margin-top: 10px;
      padding-top: 5px;
      border-top: 1px solid black;
      overflow: scroll;
    }

    .work-area {
      fill: none;
      stroke: black;
      vector-effect: non-scaling-stroke;
    }

    .position-value {
      padding-left: 10px;
    }

    .temp-svg {
      visibility: none;
    }

    .dragged-over {
      background: lightgreen;
      border: 2px dashed black;
    }

    .job-title {
      font-size: 1.1em;
      font-weight: bold;
    }

    .job-entry {
      padding-left: 10px;
      border: 1px solid #00000000;
      margin: 2px;
      display: flex;
      justify-content: space-between;
    }

    .delete-shape {
      padding-right: 20px;
    }

    .delete-shape:hover {
      color: red;
    }

    .job-entry:hover {
      cursor: pointer;
      border: 1px solid grey;
    }

    .shape:hover {
      stroke-width: 3px;
      stroke: blue;
    }

    .transform-toolbox {
      position: absolute;
      left: 100%;
      bottom: 0px;
      width: 250px;
      padding: 10px;
      background: #fff7f7;
      border: 1px solid black;
      border-bottom: none;
      z-index: 10;
    }

    .transform-term {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .transform-inputs {
      display: flex;
      width: 50%;
    }

    .transform-inputs > * {
      width: 50px;
      margin: 5px;
      box-sizing: border-box;
    }

    .translate-handle:hover {
      fill: orange;
      cursor: pointer;
    }
  </style>
  <div class="interface-container">
    <div class="control-panel">
      <div class="x-y">
        <div class="x-value">x:<span class="position-value">${state.position.x.toFixed(2)}</span></div>
        <div class="y-value">y:<span class="position-value">${state.position.y.toFixed(2)}</span></div>
      </div>
      <div class="button-container">
        <div class="button" @click=${onHomeClick}>home</div>
      </div>
      <div class="jobs">
        <div class="job-title">Job List</div>
        ${Object.entries(state.shapes).map((shape, i) => {
          return html`<div 
            class="job-entry"
            @mousedown=${() => {
              const isSelected = state.selectedShapes.has(shape[0]);
              if (isSelected) state.selectedShapes.delete(shape[0]);
              else state.selectedShapes.add(shape[0]);

              r();
            }}
            style="
              background: ${state.selectedShapes.has(shape[0]) ? "#ffaf2e5c" : "none"}
            ">
              Shape ${i}
              <span 
                class="delete-shape"
                @mousedown=${(e) => {
                  state.selectedShapes.delete(shape[0]);
                  delete state.shapes[shape[0]];
                  delete state.transformations[shape[0]];
                  r();
                  pauseEvent(e);
                }}
                >x</span>
            </div>`
        })}
      </div>
      <div class="button-container">
        <div class="button" @click=${onCutClick}>cut</div>
      </div>
      ${state.selectedShapes.size === 1 ? transformWidget(state) : ""}
    </div>
    <svg class="svg-viewer">
      <g class="transform-group">
        <rect class="work-area" width="${state.workArea.width}" height="${state.workArea.height}" />
        ${ true ? "" :
        Object.entries(state.shapes).map(shape => {
          let d = "";
          const transform = state.transformations[shape[0]];
         
          const transformedShape = getTransformedShape(shape[0]);
          transformedShape.forEach(pl => pl.forEach((pt, i) => {
            if (i === 0) d += `M ${pt[0]} ${pt[1]}`;
            else d += `L ${pt[0]} ${pt[1]}`
          }))

          return svg`<path 
            class="shape"
            @mousedown=${(e) => {
              if (state.selectedShapes.has(shape[0])) {
                state.selectedShapes.delete(shape[0]);
              } else {
                state.selectedShapes.add(shape[0]);
              }
              r();
              pauseEvent(e);
            }} 
            fill="none" 
            stroke=${state.selectedShapes.has(shape[0]) ? "red" : "black"}
            vector-effect="non-scaling-stroke" 
            d="${d}">
            </path>`
        })
        }
        ${getColoredShapes(state)}
        <circle r="${5/(state.panZoomFuncs ? state.panZoomFuncs.scale() : 1)}" fill="teal" cx=${0} cy=${0}></circle>
        <circle r="${5/(state.panZoomFuncs ? state.panZoomFuncs.scale() : 1)}" fill="red" cx=${state.position.x} cy=${state.position.y}></circle>
        ${transformHandle(state)}
      </g>
    </svg>
  </div>
  <svg class="temp-svg"></svg>
`

function r() { 
  render(view(state), viewWindow);
}

r();

function addPanZoom(el, state) {
  const listen = createListener(el);

  let mousedown = false;

  let scale = 1;
  let pointX = 0;
  let pointY = 0;
  let start = { x: 0, y: 0 };

  function setTransform(el) {
    el.style.transformOrigin = `${0}px ${0}px`;
    el.style.transform =
      "translate(" + pointX + "px, " + pointY + "px) scale(" + scale + ")";
    // if (state.gridSize > 0) dispatch("RENDER");
  }

  function svgPoint({ x, y }) {
    let newX = (x - pointX) / scale;
    let newY = (y - pointY) / scale;

    return { x: newX, y: newY };
  }

  listen("pointerdown", "", (e) => {
    if (e.shiftKey) return;

    mousedown = true;

    start = { x: e.offsetX - pointX, y: e.offsetY - pointY };

    if (e.detail === 2) {
      // console.log(
      //   e.offsetX,
      //   e.offsetY,
      //   svgPoint({ x: e.offsetX, y: e.offsetY })
      // );
    }
  });

  listen("pointermove", "", (e) => {
    if (!mousedown) return;
    if (state.transforming) return;

    pointX = e.offsetX - start.x;
    pointY = e.offsetY - start.y;

    const imgs = document.querySelectorAll(".transform-group");

    for (const img of imgs) {
      setTransform(img);
    }
  });

  listen("pointerup", "", (evt) => {
    mousedown = false;
  });

  listen("wheel", "", (e) => {
    let xs = (e.offsetX - pointX) / scale;
    let ys = (e.offsetY - pointY) / scale;

    if (Math.sign(e.deltaY) < 0) scale *= 1.03;
    else scale /= 1.03;

    pointX = e.offsetX - xs * scale;
    pointY = e.offsetY - ys * scale;

    const imgs = document.querySelectorAll(".transform-group");
    for (const img of imgs) {
      setTransform(img);
    }

    e.preventDefault();
  });

  function setScaleXY(limits) {
    const bb = el.getBoundingClientRect();
    const xr = limits.x[1] - limits.x[0];
    const yr = limits.y[1] - limits.y[0];
    const xScalingFactor = bb.width / xr;
    const yScalingFactor = bb.height / yr;

    const scalingFactor = Math.min(xScalingFactor, yScalingFactor) * 0.9;

    scale = scalingFactor;

    const center = {
      x: ((limits.x[0] + limits.x[1]) / 2) * scalingFactor - bb.width / 2,
      y: ((limits.y[0] + limits.y[1]) / 2) * scalingFactor - bb.height / 2,
    };

    pointX = -center.x;
    pointY = -center.y;

    const imgs = document.querySelectorAll(".transform-group");
    for (const img of imgs) {
      setTransform(img);
    }
  }

  function corners() {
    const { left, right, bottom, top, width, height } =
      el.getBoundingClientRect();
    // need rt, lt, rb, lb
    const rt = svgPoint({ x: width, y: height });
    // rt.y = -rt.y
    const lt = svgPoint({ x: 0, y: height });
    // lt.y = -lt.y
    const rb = svgPoint({ x: width, y: 0 });
    // rb.y = -rb.y
    const lb = svgPoint({ x: 0, y: 0 });
    // lb.y = -lb.y

    return { rt, lt, rb, lb };
  }

  return {
    scale: () => scale,
    x: () => pointX,
    y: () => pointY,
    corners,
    svgPoint,
    setScaleXY,
  };
}

const svgEl = viewWindow.querySelector(".svg-viewer");

state.panZoomFuncs = addPanZoom(svgEl, state);

function trigger(e) {
  return e.composedPath()[0];
}

function matchesTrigger(e, selectorString) {
  return trigger(e).matches(selectorString);
}

// create on listener
function createListener(target) {
  return (eventName, selectorString, event) => {
    // focus doesn't work with this, focus doesn't bubble, need focusin
    target.addEventListener(eventName, (e) => {
      e.trigger = trigger(e); // Do I need this? e.target seems to work in many (all?) cases
      if (selectorString === "" || matchesTrigger(e, selectorString)) event(e);
    });
  };
}


function addMoveOnClick(el, state) {
  const listenSVG = createListener(el);
  let moved = false;

  listenSVG("mousedown", "", e => {
    moved = false;
  })

  listenSVG("mousemove", "", e => {
    moved = true;
  })

  listenSVG("mouseup", "", (e) => {
    const pt = state.panZoomFuncs.svgPoint({ x: e.offsetX, y: e.offsetY });

    if (!moved) {
      state.position = pt;
      onSVGmouseup(pt);
      r();
    }
  })
}

addMoveOnClick(svgEl, state);

function addTranslateHandle(el, state) {
  const listenSVG = createListener(el);
  let moved = false;
  let clickedPt = null;
  let ogDxs = {};
  let ogDys = {};

  listenSVG("mousedown", ".translate-handle", e => {
    state.transforming = true;
    clickedPt = state.panZoomFuncs.svgPoint({ x: e.offsetX, y: e.offsetY });
    [...state.selectedShapes].forEach(id => {
      const { dx, dy } = state.transformations[id];
      ogDxs[id] = dx;
      ogDys[id] = dy;
    })
  })

  listenSVG("mousemove", "", e => {
    if (!clickedPt) return;
    const pt = state.panZoomFuncs.svgPoint({ x: e.offsetX, y: e.offsetY });

    const dx = pt.x - clickedPt.x;
    const dy = pt.y - clickedPt.y;

    [...state.selectedShapes].forEach(id => {
      state.transformations[id].dx = Math.round((dx + ogDxs[id])*100)/100;
      state.transformations[id].dy = Math.round((dy + ogDys[id])*100)/100;
    })

    r();
  })

  listenSVG("mouseup", "", (e) => {
    state.transforming = false;
    clickedPt = null;
    ogDxs = {};
    ogDys = {};
  })

  listenSVG("mouseleave", "", (e) => {
    state.transforming = false;
    clickedPt = null;
    ogDxs = {};
    ogDys = {};
  })
}

addTranslateHandle(svgEl, state);

function addSVGDropUpload(el, state) {
  const listenSVG = createListener(el);
  let moved = false;

  listenSVG("mousedown", "", e => {
    moved = false;
  })

  listenSVG("mousemove", "", e => {
    moved = true;
  })

  listenSVG("mouseup", "", (e) => {
    const pt = state.panZoomFuncs.svgPoint({ x: e.offsetX, y: e.offsetY });

    if (!moved) {
      state.position = pt;
      onSVGmouseup(pt);
      r();
    }
  })
}

svgEl.addEventListener("wheel", () => {
  r();
})

function onHomeClick() {
  console.log("you clicked home");
  console.log(getColoredShapes(state));
}

function onCutClick() {
  console.log("you clicked cut");
}

function onSVGmouseup({x, y}) {
  console.log("you clicked in the svg");
}

function readFileSVG(file) {
  var reader = new FileReader();
  reader.readAsText(file);

  reader.onloadend = event => {
    let text = reader.result;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "image/svg+xml");
    const svg = doc.querySelector("svg");
    const pls = flattenSVG(svg, { maxError: 0.001 });
    
    const seperatedColors = [];

    const colors = {};
    pls.forEach(pl => {
      if (!(pl.stroke in colors)) colors[pl.stroke] = [ pl ];
      else colors[pl.stroke].push(pl);
    })

    for (const color in colors) {
      seperatedColors.push(colors[color])
    }

    const makeNewShape = (pls) => {
      const id = guidGenerator();
      // map imported points
      state.shapes[id] = pls.map(x => x.points.map( ([x, y]) => [x, -y] ));
      state.strokes[id] = pls.map(x => x.stroke);
      state.transformations[id] = {
        dx: 0,
        dy: 0,
        rotate: 0,
        scaleX: 1,
        scaleY: 1,
      };
    }

    seperatedColors.forEach(makeNewShape);

    r();
  };

}

function guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function addDropUpload(el, state) {
  const listenSVG = createListener(el);

  listenSVG("dragenter", "", () => {
    el.classList.add("dragged-over");
  })

  listenSVG("dragover", "", function(evt) {    
    el.classList.add("dragged-over");
    pauseEvent(evt);
  });
  
  listenSVG("drop", "", function(evt) {    
    let dt = evt.dataTransfer;
    let files = dt.files;

    let file = files[0];
    readFileSVG(file);
    // upload(files);

    pauseEvent(evt);
    
    el.classList.remove("dragged-over");

  });

  listenSVG("dragout", "", () => {
    el.classList.remove("dragged-over");
  })


}

addDropUpload(svgEl, state);

function pauseEvent(e) {
    if(e.stopPropagation) e.stopPropagation();
    if(e.preventDefault) e.preventDefault();
    e.cancelBubble=true;
    e.returnValue=false;
    return false;
}

function transformHandle(state) {
  if (state.selectedShapes.size === 0) return "";
  const selectedShapes = [...state.selectedShapes].map(id => getTransformedShape(id));
  const [x, y] = getCenter(selectedShapes.flat(2));

  return svg`
    <circle 
      class="translate-handle"
      r="${5/(state.panZoomFuncs ? state.panZoomFuncs.scale() : 1)}" 
      fill="blue" 
      cx=${x} 
      cy=${y}>
      </circle>
  `
}

function transformWidget(state) {  
  return html`
    <div class="transform-toolbox">
      <div class="transform-term">
        <span>Translate (x, y):</span> 
        <span class="transform-inputs">
          <input 
            data-type="dx"
            .value=${state.transformations[[...state.selectedShapes][0]].dx}
            @input=${e => {}}
            />
          <input 
            data-type="dy"
            .value=${state.transformations[[...state.selectedShapes][0]].dy}
            @input=${e => {}}
            />
        </span>
      </div>
      
      <div class="transform-term">
        <span>Rotate (degs):</span> 
        <span class="transform-inputs">
          <input 
            data-type="rotate"
            .value=${state.transformations[[...state.selectedShapes][0]].rotate}
            @input=${e => {}}
            />
        </span>
      </div>
      
      <div class="transform-term">
        <span>Scale (x, y):</span> 
        <span class="transform-inputs">
          <input 
            data-type="scaleX"
            .value=${state.transformations[[...state.selectedShapes][0]].scaleX}
            @input=${e => {}}
            />
          <input 
            data-type="scaleY"
            .value=${state.transformations[[...state.selectedShapes][0]].scaleY}
            @input=${e => {}}
            />
        </span>
      </div>
      
      <div class="button-container minor-button">
        <div class="button" @click=${applyTransformation}>apply</div>
      </div>
    </div>
  `
}

function applyTransformation() {
  const id = [...state.selectedShapes][0];
  const transforms = state.transformations[id];
  const transformInputs = viewWindow
    .querySelector(".transform-toolbox")
    .querySelectorAll("input");
  const transform = {};
  for (const input of transformInputs) {
    transform[input.dataset.type] = Number(input.value);
  }

  state.transformations[id] = transform;
  r();
}

function rotate(pt, origin, angle) {
  let delta = angle / 180 * Math.PI;

  let hereX = pt[0] - origin[0];
  let hereY = pt[1] - origin[1];

  let newPoint = [
    hereX * Math.cos(delta) - hereY * Math.sin(delta) + origin[0],
    hereY * Math.cos(delta) + hereX * Math.sin(delta) + origin[1]
  ];

  return newPoint;
}

function scale(pt, origin, scale) {
  const [xScale, yScale] = scale;
  const [x, y] = origin;
  const newPoint = [
    ((pt[0]-x) * xScale) + x,
    ((pt[1]-y) * yScale) + y
  ];

  return newPoint;
}

function getCenter(pts) {
  const {xMax, xMin, yMax, yMin} = extrema(pts);
  
  let middX = (xMax + xMin) / 2;
  let middY = (yMax + yMin) / 2;

  return [middX, middY];
}

function extrema(pts) {
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;

  pts.forEach(p => {
    const [ x, y ] = p;
    
    if (xMin > x) xMin = x;
    if (xMax < x) xMax = x;
    if (yMin > y) yMin = y;
    if (yMax < y) yMax = y;
  });

  return {
    xMin,
    xMax,
    yMin,
    yMax
  };
}

function getTransformedShape(id) {
  const shape = state.shapes[id];
  const transform = state.transformations[id];    
  const center = getCenter(shape.flat());

  const newShape = shape.map(pl => pl.map(pt => {
    pt = rotate(pt, center, transform.rotate)
    pt = scale(pt, center, [transform.scaleX, transform.scaleY]);
    pt = [
      pt[0] + transform.dx,
      pt[1] + transform.dy
    ];

    return pt;
  }))

  return newShape;   
}

function getColoredShapes(state) {
  const groups = Object.entries(state.shapes).map(shape => {
    const [id, points] = shape;
    const paths = [];
    const transformedShape = getTransformedShape(id);
    transformedShape.forEach((pl, i) => {
      let d = "";   

      pl.forEach((pt, j) => {
        if (j === 0) d += `M ${pt[0]} ${pt[1]}`;
        else d += `L ${pt[0]} ${pt[1]}`
      })

      paths.push(svg`
        <path 
          @mousedown=${(e) => {
            if (state.selectedShapes.has(id)) {
              state.selectedShapes.delete(id);
            } else {
              state.selectedShapes.add(id);
            }
            r();
            pauseEvent(e);
          }} 
          fill="none" 
          stroke=${state.selectedShapes.has(id) ? "red" : state.strokes[id][i]}
          vector-effect="non-scaling-stroke" 
          d="${d}">
          </path>
      `)
    })

    return svg`<g class="shape">${paths}</g>`;
  })

  return groups
}

// function uploadSVG(file) {

//   var reader = new FileReader();

//   reader.onload = (event) => {
//     let text = event.target.result;

//     let tempSVG = viewWindow.querySelector('.temp-svg');
//     tempSVG.innerHTML = text;
    
//     let paths = flattenSVG(tempSVG);

//     console.log(paths);

//   };

//   reader.readAsText(file);
// }






