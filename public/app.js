//--------------------------------------------------------------------------------------------------
window.addEventListener("load", InitApp);

let gCarAttachment = null;
let gSelectedCar = null;
let gSelectedMaterial = null;
let gColor = null;
let gIntensity = 0;
let carParts = {
  body: null,
  frontBumper: null,
  rearBumper: null,
  spoiler: null,
};

//--------------------------------------------------------------------------------------------------
async function InitApp() {
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  const viewports = [
    {
      id: 0,
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      defaultControllerType: 1,
    },
  ];
  SDK3DVerse.setViewports(viewports);
  SetResolution();

  let debounceResizeTimeout = null;
  window.addEventListener("resize", () => {
    if (debounceResizeTimeout) {
      clearTimeout(debounceResizeTimeout);
    }
    debounceResizeTimeout = setTimeout(() => {
      SetResolution(false);
      debounceResizeTimeout = null;
    }, 100);
  });

  const sessionCreated = await Connect();

  FadeOut();
  SetInformation("");
  await InitCarAttachment();

  gSelectedMaterial = AppConfig.materials[0];
  await ChangeCar({ value: 0 });
}

//--------------------------------------------------------------------------------------------------
async function InitCarAttachment() {
  [gCarAttachment] = await SDK3DVerse.engineAPI.findEntitiesByNames(
    "CAR_ATTACHMENT"
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeCar(e) {
  gSelectedCar = AppConfig.cars[e.value];
  await RemoveExistingCar();
  await ApplySelectedCar();
  await InitColor();
  await ApplySelectedMaterial();
}

//--------------------------------------------------------------------------------------------------
async function ChangeSpoiler(e) {
  const i = e.value;
  if (i >= gSelectedCar.spoilers.length) {
    return;
  }

  carParts.spoiler = await ChangePart(
    carParts.spoiler,
    gSelectedCar.name + " SPOILER " + i,
    gSelectedCar.spoilers[i]
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeFrontBumper(e) {
  const i = e.value;
  if (i >= gSelectedCar.frontBumpers.length) {
    return;
  }

  carParts.frontBumper = await ChangePart(
    carParts.frontBumper,
    gSelectedCar.name + " FRONT BUMPER " + i,
    gSelectedCar.frontBumpers[i]
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeRearBumper(e) {
  const i = e.value;
  if (i >= gSelectedCar.rearBumpers.length) {
    return;
  }

  carParts.rearBumper = await ChangePart(
    carParts.rearBumper,
    gSelectedCar.name + " REAR BUMPER " + i,
    gSelectedCar.rearBumpers[i]
  );
}

//--------------------------------------------------------------------------------------------------
async function RemoveExistingCar() {
  const children = await SDK3DVerse.engineAPI.getEntityChildren(gCarAttachment);
  await SDK3DVerse.engineAPI.deleteEntities(children);

  carParts.body = null;
  carParts.frontBumper = null;
  carParts.rearBumper = null;
  carParts.spoiler = null;
}

//--------------------------------------------------------------------------------------------------
async function ApplySelectedCar() {
  carParts.body = await ChangePart(
    carParts.body,
    gSelectedCar.name,
    gSelectedCar.sceneUUID
  );
  await ChangeFrontBumper({ value: 0 });
  await ChangeRearBumper({ value: 0 });
  await ChangeSpoiler({ value: 0 });
}

//--------------------------------------------------------------------------------------------------
async function ChangePart(part, name, partUUID) {
  if (part !== null) {
    await SDK3DVerse.engineAPI.deleteEntities([part]);
  }

  return await SelectPart(name, partUUID);
}

//--------------------------------------------------------------------------------------------------
async function SelectPart(partName, partSceneUUID) {
  const part = { debug_name: { value: partName } };
  SDK3DVerse.utils.resolveComponentDependencies(part, "scene_ref");

  part.scene_ref.value = partSceneUUID;
  return await SDK3DVerse.engineAPI.spawnEntity(gCarAttachment, part);
}

//--------------------------------------------------------------------------------------------------
// use setTimeout to delay a task that may be async (returning a promise) or not.
// wrap the setTimeout in a Promise that can be awaited.
function asyncSetTimeout(task, delay) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      let result;
      try {
        result = task();
      } catch (error) {
        // the task has thrown an error
        return reject(error);
      }

      if (result && typeof result.then === "function") {
        // the result is a promise so we deal with it
        return result.then(resolve).catch(reject);
      }

      // the result is not a promise so we can resolve it
      return resolve(result);
    }, delay);
  });
}

//--------------------------------------------------------------------------------------------------
function SetInformation(str) {
  const infoSpan = document.getElementById("info_span");
  infoSpan.innerHTML = str;
  console.debug(str);
}

//--------------------------------------------------------------------------------------------------
function FadeOut() {
  const fade = document.getElementById("fade");
  fade.style.animation = "fadeOut linear 2s";
}

//--------------------------------------------------------------------------------------------------
function SetResolution(showInfo = true) {
  const container = document.getElementById("container");
  const canvasSize = container.getBoundingClientRect();
  //const canvasSize    = {width: window.innerWidth, height: window.innerHeight};

  const largestDim = Math.max(canvasSize.width, canvasSize.height);
  const MAX_DIM = 1920;
  const scale = largestDim > MAX_DIM ? MAX_DIM / largestDim : 1;

  let w = Math.floor(canvasSize.width);
  let h = Math.floor(canvasSize.height);
  const aspectRatio = w / h;

  if (w > h) {
    // landscape
    w = Math.floor(aspectRatio * h);
  } else {
    // portrait
    h = Math.floor(w / aspectRatio);
  }
  SDK3DVerse.setResolution(w, h, scale);

  if (showInfo) {
    SetInformation(`Setting resolution to ${w} x ${h} (scale=${scale})`);
  }
}

//------------------------------------------------------------------------------
SDK3DVerse.webAPI.getAssetDescription = async function (assetType, assetUUID) {
  return await this.httpGet(`asset/desc/${assetType}/${assetUUID}`, {
    token: this.apiToken,
  });
};

let rotationState = false;
//--------------------------------------------------------------------------------------------------
function ToggleRotation() {
  const event = rotationState ? "pause_simulation" : "start_simulation";
  rotationState = !rotationState;

  SDK3DVerse.engineAPI.fireEvent(SDK3DVerse.utils.invalidUUID, event);
}

//--------------------------------------------------------------------------------------------------
function Reset() {
  SDK3DVerse.engineAPI.fireEvent(
    SDK3DVerse.utils.invalidUUID,
    "stop_simulation"
  );
  rotationState = false;
}

//--------------------------------------------------------------------------------------------------
async function Connect() {
  SetInformation("Connecting to 3dverse...");

  //const connectionInfo = await SDK3DVerse.webAPI.createOrJoinSession(
  const connectionInfo = await SDK3DVerse.webAPI.createSession(
    AppConfig.sceneUUID
  );
  connectionInfo.useSSL = true;
  SDK3DVerse.setupDisplay(document.getElementById("display_canvas"));
  SDK3DVerse.startStreamer(connectionInfo);
  await SDK3DVerse.connectToEditor();
  SetInformation("Connection to 3dverse established...");
  return true; //connectionInfo.sessionCreated;
}

//--------------------------------------------------------------------------------------------------
async function InitColor() {
  const desc = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedCar.paintMaterialUUID
  );
  gColor = desc.dataJson.albedo;
}

//--------------------------------------------------------------------------------------------------
async function ChangeColor() {
  gColor = [Math.random(), Math.random(), Math.random()];
  const desc = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedMaterial.matUUID
  );
  desc.dataJson.albedo = gColor;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.paintMaterialUUID,
    desc
  );
}

//--------------------------------------------------------------------------------------------------
async function ChangeMaterial(e) {
  const matIndex = e.value;
  gSelectedMaterial = AppConfig.materials[matIndex];
  await ApplySelectedMaterial();
}

//--------------------------------------------------------------------------------------------------
async function ApplySelectedMaterial() {
  const desc = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedMaterial.matUUID
  );
  desc.dataJson.albedo = gColor;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.paintMaterialUUID,
    desc
  );
}

async function ToggleLights() {
  const desc1 = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedCar.headLightsMatUUID
  );
  desc1.dataJson.emissionIntensity = gIntensity;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.headLightsMatUUID,
    desc1
  );

  const desc2 = await SDK3DVerse.webAPI.getAssetDescription(
    "material",
    gSelectedCar.rearLightsMatUUID
  );
  desc2.dataJson.emissionIntensity = gIntensity;
  SDK3DVerse.engineAPI.ftlAPI.updateMaterial(
    gSelectedCar.rearLightsMatUUID,
    desc2
  );

  gIntensity = gIntensity === 0 ? 100 : 0;
}
