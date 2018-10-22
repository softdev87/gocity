import React, { Component } from "react";
import FloatBox from "./FloatBox";
import * as BABYLON from "babylonjs";
import BabylonScene from "./Scene";
import axios from "axios";
import Navbar from "./Nav";
import Legend from "./Legend";
import Loading from "./Loading"
import {feedbackEvent, getProportionalColor, searchEvent} from "./utils";
import FeedbackForm from "./form/FeedbackForm";

const URLRegexp = new RegExp(/^(?:https:\/\/?)?(github\.com\/.*)/i);

const endpoint = process.env.REACT_APP_API_URL;

// TODO: isolate in the constants file
const colors = {
  PACKAGE: {
    start: { r: 255, g: 100, b: 100 },
    end: { r: 255, g: 100, b: 100 }
  },
  FILE: {
    start: { r: 255, g: 255, b: 255 },
    end: { r: 0, g: 0, b: 0 }
  },
  STRUCT: {
    start: { r: 32, g: 156, b: 238 },
    end: { r: 0, g: 0, b: 0 }
  }
};

const examples = [
  {
    name: "sirupsen/logrus",
    link: "github.com/sirupsen/logrus"
  },
  {
    name: "golang/dep",
    link: "github.com/golang/dep"
  },
  {
    name: "gohugoio/hugo",
    link: "github.com/gohugoio/hugo",
    json: "/examples/hugo.json"
  },
  {
    name: "spf13/cobra",
    link: "github.com/spf13/cobra"
  }
];

class App extends Component {
  canvas = null;
  scene = null;
  engine = null;
  camera = null;
  light = null;

  constructor(props) {

    super(props);
    this.state = {
      feedbackFormActive: false,
      loading: false,
      repository: this.props.match.params.repository || "github.com/rodrigo-brito/gocity"
    };

    this.addBlock = this.addBlock.bind(this);
    this.onInputChange = this.onInputChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
    this.plot = this.plot.bind(this);
    this.process = this.process.bind(this);
    this.reset = this.reset.bind(this);
    this.initScene = this.initScene.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.updateCamera = this.updateCamera.bind(this);
    this.onSceneMount = this.onSceneMount.bind(this);
    this.onFeedBackFormClose = this.onFeedBackFormClose.bind(this);
    this.openFeedBackForm = this.openFeedBackForm.bind(this);
  }

  componentDidMount() {
    if (this.state.repository) {
      this.process(this.state.repository);
    }
  }

  onMouseMove(e) {
    this.mouse_x = e.pageX;
    this.mouse_y = e.pageY;
  }

  showTooltip(info) {
    this.setState({
      infoVisible: true,
      infoData: info,
      infoPosition: { x: this.mouse_x, y: this.mouse_y }
    });
  }

  hideTooltip() {
    this.setState({
      infoVisible: false
    });
  }

  reset() {
    this.scene.dispose();
    this.scene = new BABYLON.Scene(this.engine);
    this.initScene();
  }

  addBlock = data => {
    const bar = BABYLON.MeshBuilder.CreateBox(
      data.label,
      { width: data.width, depth: data.depth, height: data.height },
      this.scene
    );
    if (data.parent) {
      bar.parent = data.parent;

      var bounds = data.parent.getBoundingInfo();
      bar.position.y = bounds.maximum.y + data.height / 2.0;
    }
    bar.position.x = data.x || 0;
    bar.position.z = data.y || 0;

    bar.info = data.info;

    bar.actionManager = new BABYLON.ActionManager(this.scene);
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOverTrigger,
        () => {
          this.showTooltip(bar.info);
        }
      )
    );

    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOutTrigger,
        this.hideTooltip
      )
    );

    // Material
    bar.material = new BABYLON.StandardMaterial(data.label + "mat", this.scene);
    bar.material.diffuseColor = data.color;
    bar.material.emissiveColor = new BABYLON.Color3(0, 0, 0);

    // Light on hover
    bar.actionManager.registerAction(
      new BABYLON.SetValueAction(
        BABYLON.ActionManager.OnPointerOverTrigger, bar.material, "emissiveColor", data.color.scale(0.2)
      )
    );

    bar.actionManager.registerAction(
      new BABYLON.SetValueAction(
        BABYLON.ActionManager.OnPointerOutTrigger, bar.material, "emissiveColor", bar.material.emissiveColor
      )
    );

    return bar;
  };

  plot(children, parent) {
    if (!children) {
      return;
    }

    children.forEach(data => {
      var color = getProportionalColor(
        colors[data.type].start,
        colors[data.type].end,
        Math.min(100, data.numberOfLines / 2000.0)
      );

      var mesh = this.addBlock({
        x: data.position.x,
        y: data.position.y,
        width: data.width,
        depth: data.depth,
        height: data.numberOfMethods,
        color: new BABYLON.Color3(color.r / 255, color.g / 255, color.b / 255),
        parent: parent,
        info: {
          name: data.name,
          url: data.url,
          type: data.type,
          NOM: data.numberOfMethods,
          NOL: data.numberOfLines,
          NOA: data.numberOfAttributes
        }
      });

      if (parent) {
        mesh.parent = parent;
      }

      if (data.children && data.children.length > 0) {
        this.plot(data.children, mesh);
      }
    });
  }

  updateCamera(width, height) {
    width = Math.min(width, 1000);
    height = Math.min(height, 1000);
    this.camera.setPosition(
      new BABYLON.Vector3(width, width, width + height / 2)
    );
  }

  initScene() {
    this.scene.clearColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    this.scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    // This creates and positions a free camera (non-mesh)
    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      0,
      0,
      10,
      BABYLON.Vector3.Zero(),
      this.scene
    );

    // This targets the camera to scene origin
    this.camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    this.camera.attachControl(this.canvas, true);

    this.camera.setPosition(new BABYLON.Vector3(500, 400, -100));
    this.camera.useAutoRotationBehavior = true;

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight(
      "global_light",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );

    light.intensity = 0.7;
  }

  onSceneMount(e) {
    this.scene = e.scene;
    this.canvas = e.canvas;
    this.engine = e.engine;

    this.initScene();

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.scene.render();
      }
    });
  }

  onInputChange(e) {
    this.setState({ repository: e.target.value });
  }

  process(repository, json) {
    if (!BABYLON.Engine.isSupported()) {
      return;
    }

    const match = URLRegexp.exec(repository);
    if (!match) {
      alert("Invalid URL! Please inform a valid Github URL.");
      return;
    }

    if (match !== this.props.match.params.repository) {
      this.props.history.push(`/${match[1]}`);
    }

    this.setState({
      repository: match[1],
      loading: true
    });

    let request = null;
    if (json) {
      request = axios.get(json)
    } else {
      request = axios
        .get(endpoint, {
          params: {
            q: match[1]
          }
        })
    }

    request.then(response => {
        this.setState({loading: false});
        this.reset();
        this.plot(response.data.children);
        this.updateCamera(response.data.width, response.data.depth);
      })
      .catch(e => {
        this.setState({loading: false});
        alert("Error on plot project, try again later.");
        console.error(e);
      });
  }

  onClick() {
    searchEvent(this.state.repository);
    this.process(this.state.repository);
  }

  onFeedBackFormClose() {
    this.setState({feedbackFormActive: false});
  }

  openFeedBackForm() {
    this.setState({feedbackFormActive: true});
    feedbackEvent()
  }

  render() {
    return (
      <main onMouseMove={this.onMouseMove}>
        <FloatBox
          position={this.state.infoPosition}
          info={this.state.infoData}
          visible={this.state.infoVisible}
        />
        <header className="header">
          <div className="container">
            <Navbar />
            <div className="field has-addons">
              <div className="control is-expanded">
                <input
                  onChange={this.onInputChange}
                  className="input"
                  id="repository"
                  type="text"
                  placeholder="eg: github.com/golang/go"
                  value={this.state.repository}
                />
              </div>
              <div className="control">
                <a
                  id="search"
                  onClick={this.onClick}
                  className="button is-info"
                >
                  Plot
                </a>
              </div>
            </div>
            <div className="level">
              <small className="level-left">
                  Examples: {examples.map(example => (
                  <a
                    className="m-l-10"
                    key={example.link}
                    onClick={() => {
                      this.process(example.link, example.json);
                    }}
                  >
                    {example.name}
                  </a>
                ))}
              </small>
              <button className="button is-primary level-right" onClick={this.openFeedBackForm}>
                <svg
                  version="1.1"
                  width="16px"
                  height="16px"
                  viewBox="0 0 427 427"
                  aria-hidden="true"
                  className="m-r-10"
                >
                  <g>
                    <path d="M384,0H42.667C19.093,0,0.213,19.093,0.213,42.667L0,426.667l85.333-85.333H384c23.573,0,42.667-19.093,42.667-42.667    v-256C426.667,19.093,407.573,0,384,0z M149.333,192h-42.667v-42.667h42.667V192z M234.667,192H192v-42.667h42.667V192z M320,192    h-42.667v-42.667H320V192z" fill="#FFFFFF"/>
                  </g>
                </svg>
                &nbsp;User comments</button>
            </div>
          </div>
        </header>
        <section className="canvas">
          {this.state.loading ?
              <Loading message="Fetching repository..."/> :
              <BabylonScene
                width={window.innerWidth}
                engineOptions={{ preserveDrawingBuffer: true, stencil: true }}
                onSceneMount={this.onSceneMount}
              />
            }
        </section>
        <Legend />
        <FeedbackForm
          active={this.state.feedbackFormActive}
          projectURL={this.state.repository}
          onClose={this.onFeedBackFormClose}/>
      </main>
    );
  }
}

export default App;
