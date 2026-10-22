// packages/fit-engine/src/body-profile.ts
var BODY_LIMITS = {
  height_cm: [150, 210],
  bust_cm: [60, 180],
  waist_cm: [45, 160],
  hips_cm: [65, 190],
  shoulder_cm: [28, 65],
  inseam_cm: [55, 110],
  arm_cm: [40, 85],
  underbust_cm: [55, 170],
  back_width_cm: [20, 60],
  torso_length_cm: [25, 65],
  neck_cm: [25, 55],
  thigh_cm: [35, 95],
  calf_cm: [20, 60],
  upper_arm_cm: [18, 55],
  wrist_cm: [11, 25],
  ankle_cm: [15, 35]
};
var BASE_WEIGHTS = {
  height_cm: 0.15,
  bust_cm: 0.2,
  waist_cm: 0.2,
  hips_cm: 0.2,
  shoulder_cm: 0.15,
  inseam_cm: 0.1
};
var OPTIONAL_MEASURE_KEYS = [
  "underbust_cm",
  "back_width_cm",
  "torso_length_cm",
  "neck_cm",
  "thigh_cm",
  "calf_cm",
  "upper_arm_cm",
  "wrist_cm",
  "ankle_cm"
];
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function numberOr(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function limit(key, value) {
  const [min, max] = BODY_LIMITS[key];
  return clamp(value, min, max);
}
function readMeasurement(key, value, fallback, inferred, warnings) {
  if (value === void 0) {
    inferred.push(key);
    return limit(key, fallback);
  }
  const [min, max] = BODY_LIMITS[key];
  if (value < min || value > max) {
    const clamped = clamp(value, min, max);
    warnings.push({
      code: "measurement_clamped",
      message: `${key}=${value.toFixed(1)} cm est\xE1 fuera de [${min}, ${max}]; se ajusta a ${clamped.toFixed(1)} cm.`,
      severity: "warn"
    });
    return clamped;
  }
  return value;
}
function resolveBodyProfile(profile) {
  const warnings = [];
  const inferred = [];
  const sex = profile.sex === "male" || profile.sex === "female" ? profile.sex : "neutral";
  if (profile.sex !== void 0 && sex === "neutral" && profile.sex !== "neutral") {
    warnings.push({
      code: "sex_invalid",
      message: `Sexo "${String(profile.sex)}" no reconocido; se usa "neutral".`,
      severity: "info"
    });
  }
  const height = readMeasurement(
    "height_cm",
    numberOr(profile.height_cm),
    170,
    inferred,
    warnings
  );
  const bustFallback = sex === "female" ? 0.53 * height : sex === "male" ? 0.56 * height : 0.545 * height;
  const waistFallback = sex === "female" ? 0.42 * height : sex === "male" ? 0.46 * height : 0.44 * height;
  const hipsFallback = sex === "female" ? 0.55 * height : sex === "male" ? 0.52 * height : 0.535 * height;
  const shoulderFallback = sex === "female" ? 0.225 * height : sex === "male" ? 0.245 * height : 0.235 * height;
  const inseamFallback = 0.46 * height;
  const armFallback = 0.34 * height;
  const bust = readMeasurement("bust_cm", numberOr(profile.bust_cm), bustFallback, inferred, warnings);
  const waist = readMeasurement("waist_cm", numberOr(profile.waist_cm), waistFallback, inferred, warnings);
  const hips = readMeasurement("hips_cm", numberOr(profile.hips_cm), hipsFallback, inferred, warnings);
  const shoulder = readMeasurement(
    "shoulder_cm",
    numberOr(profile.shoulder_cm),
    shoulderFallback,
    inferred,
    warnings
  );
  const inseam = readMeasurement(
    "inseam_cm",
    numberOr(profile.inseam_cm),
    inseamFallback,
    inferred,
    warnings
  );
  const arm = readMeasurement("arm_cm", numberOr(profile.arm_cm), armFallback, inferred, warnings);
  const underbustFallback = sex === "female" ? bust * 0.86 : sex === "male" ? bust * 0.92 : bust * 0.89;
  const torsoLengthFallback = 0.235 * height;
  const neckFallback = sex === "female" ? 0.18 * height : sex === "male" ? 0.19 * height : 0.185 * height;
  const thighFallback = sex === "female" ? 0.33 * height : sex === "male" ? 0.31 * height : 0.32 * height;
  const calfFallback = sex === "female" ? 0.2 * height : sex === "male" ? 0.21 * height : 0.205 * height;
  const upperArmFallback = sex === "female" ? 0.165 * height : sex === "male" ? 0.175 * height : 0.17 * height;
  const wristFallback = sex === "female" ? 0.09 * height : sex === "male" ? 0.095 * height : 0.0925 * height;
  const ankleFallback = sex === "female" ? 0.125 * height : sex === "male" ? 0.13 * height : 0.1275 * height;
  const underbust = readMeasurement(
    "underbust_cm",
    numberOr(profile.underbust_cm),
    underbustFallback,
    inferred,
    warnings
  );
  const backWidth = readMeasurement(
    "back_width_cm",
    numberOr(profile.back_width_cm),
    shoulder * 0.82,
    inferred,
    warnings
  );
  const torsoLength = readMeasurement(
    "torso_length_cm",
    numberOr(profile.torso_length_cm),
    torsoLengthFallback,
    inferred,
    warnings
  );
  const neck = readMeasurement("neck_cm", numberOr(profile.neck_cm), neckFallback, inferred, warnings);
  const thigh = readMeasurement("thigh_cm", numberOr(profile.thigh_cm), thighFallback, inferred, warnings);
  const calf = readMeasurement("calf_cm", numberOr(profile.calf_cm), calfFallback, inferred, warnings);
  const upperArm = readMeasurement(
    "upper_arm_cm",
    numberOr(profile.upper_arm_cm),
    upperArmFallback,
    inferred,
    warnings
  );
  const wrist = readMeasurement("wrist_cm", numberOr(profile.wrist_cm), wristFallback, inferred, warnings);
  const ankle = readMeasurement("ankle_cm", numberOr(profile.ankle_cm), ankleFallback, inferred, warnings);
  const weightRaw = numberOr(profile.weight_kg);
  let weight;
  if (weightRaw !== void 0) {
    if (weightRaw < 30 || weightRaw > 250) {
      warnings.push({
        code: "weight_outlier",
        message: `weight_kg=${weightRaw} est\xE1 fuera de [30, 250]; se ignora.`,
        severity: "warn"
      });
    } else {
      weight = weightRaw;
    }
  }
  const bodyFatRaw = numberOr(profile.body_fat_pct);
  let bodyFat;
  if (bodyFatRaw !== void 0) {
    if (bodyFatRaw < 3 || bodyFatRaw > 60) {
      warnings.push({
        code: "body_fat_outlier",
        message: `body_fat_pct=${bodyFatRaw} est\xE1 fuera de [3, 60]; se ajusta.`,
        severity: "warn"
      });
      bodyFat = clamp(bodyFatRaw, 3, 60);
    } else {
      bodyFat = bodyFatRaw;
    }
  }
  if (weight !== void 0) {
    const bmi = weight / Math.pow(height / 100, 2);
    if (bmi < 14 || bmi > 45) {
      warnings.push({
        code: "bmi_outlier",
        message: `El IMC impl\xEDcito (${bmi.toFixed(1)}) es extremo; revisa peso y altura.`,
        severity: "warn"
      });
    }
  }
  const muscle = clamp(
    numberOr(profile.muscle) ?? (sex === "male" ? 0.55 : sex === "female" ? 0.45 : 0.5),
    0,
    1
  );
  const posture = clamp(numberOr(profile.posture) ?? 0, -1, 1);
  const bustProjection = clamp(
    numberOr(profile.bust_projection) ?? (sex === "female" ? 0.55 : sex === "male" ? 0.25 : 0.4),
    0,
    1
  );
  const seat = clamp(
    numberOr(profile.seat) ?? (bodyFat !== void 0 ? clamp((bodyFat - 12) / 35, 0, 1) : sex === "female" ? 0.6 : sex === "male" ? 0.35 : 0.48),
    0,
    1
  );
  const belly = clamp(
    numberOr(profile.belly) ?? (bodyFat !== void 0 ? clamp((bodyFat - 15) / 30, 0, 1) : 0.25),
    0,
    1
  );
  const shoulderSlope = clamp(numberOr(profile.shoulder_slope) ?? 0.45, 0, 1);
  if (waist > hips + 5) {
    warnings.push({
      code: "waist_gt_hips",
      message: `Cintura (${waist.toFixed(1)}) > cadera (${hips.toFixed(1)}) + 5 cm. Revisa las medidas; el cuerpo se genera igual.`,
      severity: "warn"
    });
  }
  if (bust < underbust + 1) {
    warnings.push({
      code: "bust_lt_underbust",
      message: `Pecho (${bust.toFixed(1)}) \u2264 bajo pecho (${underbust.toFixed(1)}). Revisa las medidas.`,
      severity: "warn"
    });
  }
  if (inseam > height * 0.55) {
    warnings.push({
      code: "inseam_too_long",
      message: `Entrepierna (${inseam.toFixed(1)} cm) > 55% de la altura. Revisa la medida.`,
      severity: "warn"
    });
  }
  if (shoulder > height * 0.36) {
    warnings.push({
      code: "shoulder_too_wide",
      message: `Hombro (${shoulder.toFixed(1)} cm) > 36% de la altura. Revisa la medida.`,
      severity: "warn"
    });
  }
  if (waist < height * 0.3) {
    warnings.push({
      code: "waist_too_small",
      message: `Cintura (${waist.toFixed(1)} cm) < 30% de la altura. Revisa la medida.`,
      severity: "warn"
    });
  }
  if (torsoLength > height * 0.34 || torsoLength < height * 0.18) {
    warnings.push({
      code: "torso_length_outlier",
      message: `Largo de espalda (${torsoLength.toFixed(1)} cm) fuera del rango esperado para ${height.toFixed(0)} cm.`,
      severity: "warn"
    });
  }
  const baseProvided = Object.keys(BASE_WEIGHTS).filter(
    (key) => numberOr(profile[key]) !== void 0
  );
  const baseCoverage = baseProvided.reduce((sum, key) => sum + BASE_WEIGHTS[key], 0);
  const optionalProvided = OPTIONAL_MEASURE_KEYS.filter(
    (key) => numberOr(profile[key]) !== void 0
  ).length;
  const optionalRatio = optionalProvided / OPTIONAL_MEASURE_KEYS.length;
  const optionalPenalty = 0.05 * (1 - optionalRatio);
  const coverage = clamp(baseCoverage + 0.1 * optionalRatio - optionalPenalty, 0, 1);
  const consistency = 1 - Math.min(0.35, warnings.filter((warning) => warning.severity !== "info").length * 0.06);
  const confidence = Math.round(clamp(0.7 * coverage + 0.3 * consistency, 0, 1) * 1e3) / 1e3;
  if (inferred.length > 0) {
    warnings.push({
      code: "inferred_values",
      message: `Valores inferidos (no medidos): ${inferred.join(", ")}.`,
      severity: "info"
    });
  }
  return {
    sex,
    height_cm: height,
    bust_cm: bust,
    waist_cm: waist,
    hips_cm: hips,
    shoulder_cm: shoulder,
    inseam_cm: inseam,
    arm_cm: arm,
    underbust_cm: underbust,
    back_width_cm: backWidth,
    torso_length_cm: torsoLength,
    neck_cm: neck,
    thigh_cm: thigh,
    calf_cm: calf,
    upper_arm_cm: upperArm,
    wrist_cm: wrist,
    ankle_cm: ankle,
    weight_kg: weight,
    body_fat_pct: bodyFat,
    muscle,
    posture,
    bust_projection: bustProjection,
    seat,
    belly,
    shoulder_slope: shoulderSlope,
    inferred,
    warnings,
    confidence
  };
}

// packages/fit-engine/src/body.ts
var TAU = Math.PI * 2;
function clamp2(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function smoothstep(t) {
  const x = clamp2(t, 0, 1);
  return x * x * (3 - 2 * x);
}
function vec(x, y, z) {
  return { x, y, z };
}
function add(a, b) {
  return vec(a.x + b.x, a.y + b.y, a.z + b.z);
}
function sub(a, b) {
  return vec(a.x - b.x, a.y - b.y, a.z - b.z);
}
function scale(v, factor) {
  return vec(v.x * factor, v.y * factor, v.z * factor);
}
function cross(a, b) {
  return vec(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
}
function lengthOf(v) {
  return Math.hypot(v.x, v.y, v.z);
}
function normalize(v) {
  const len = lengthOf(v);
  if (len < 1e-9) return vec(0, 0, 0);
  return scale(v, 1 / len);
}
function lerpVec(a, b, t) {
  return vec(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
}
function superellipsePoint(t, rx, rz, n) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const exponent = 2 / n;
  return {
    x: rx * Math.sign(c) * Math.pow(Math.abs(c), exponent),
    z: rz * Math.sign(s) * Math.pow(Math.abs(s), exponent)
  };
}
function superellipsePerimeter(rx, rz, n, samples = 96) {
  let perimeter = 0;
  let previous = superellipsePoint(0, rx, rz, n);
  for (let i = 1; i <= samples; i += 1) {
    const point = superellipsePoint(i / samples * TAU, rx, rz, n);
    perimeter += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }
  return perimeter;
}
function solveRxForCircumference(circumference, depthRatio, n) {
  const ratio = clamp2(depthRatio, 0.35, 1.4);
  let low = 1e-3;
  let high = Math.max(circumference, 1);
  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    const perimeter = superellipsePerimeter(mid, mid * ratio, n);
    if (perimeter < circumference) low = mid;
    else high = mid;
  }
  const rx = (low + high) / 2;
  return { rx, rz: rx * ratio };
}
function ringFromCircumference(y, circumference, depthRatio, n, region, cx = 0, frontBias = 0) {
  const { rx, rz } = solveRxForCircumference(circumference, depthRatio, n);
  return {
    y,
    rx,
    rz,
    cz: rz * frontBias,
    n,
    cx,
    region,
    circumference_cm: circumference
  };
}
function ringFromWidth(y, width, circumference, depthRatio, n, region, frontBias = 0) {
  const rx = Math.min(width / 2, circumference / 4.2);
  let low = 1e-3;
  let high = Math.max(circumference, 1);
  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    const perimeter = superellipsePerimeter(rx, mid, n);
    if (perimeter < circumference) low = mid;
    else high = mid;
  }
  const rz = (low + high) / 2;
  return {
    y,
    rx,
    rz,
    cz: rz * frontBias,
    n,
    cx: 0,
    region,
    circumference_cm: circumference
  };
}
function directRing(y, rx, rz, n, region, cx = 0, frontBias = 0) {
  return {
    y,
    rx,
    rz,
    cz: rz * frontBias,
    n,
    cx,
    region,
    circumference_cm: superellipsePerimeter(rx, rz, n)
  };
}
function computeTorsoLayout(profile) {
  const height = profile.height_cm;
  const crotchY = Math.min(profile.inseam_cm, 0.55 * height);
  const hipJointY = crotchY + 0.04 * height;
  const hipY = Math.max(0.55 * height, hipJointY + 3);
  const neckBaseY = 0.835 * height;
  const waistMin = hipY + 3;
  const waistMax = Math.max(waistMin + 1, 0.66 * height);
  const waistY = clamp2(neckBaseY - profile.torso_length_cm, waistMin, waistMax);
  const bustY = Math.max(0.71 * height, waistY + 0.08 * height);
  const underbustY = Math.max(waistY + 0.02 * height, bustY - 0.05 * height);
  const chestY = bustY + 0.015 * height;
  const axillaY = Math.max(0.765 * height, chestY + 0.01 * height);
  const shoulderY = Math.max(
    0.815 * height - 0.02 * height * profile.shoulder_slope,
    axillaY + 0.01 * height
  );
  const chinY = Math.max(0.87 * height, neckBaseY + 0.02 * height);
  const headTopY = height;
  const kneeY = 0.285 * height;
  const ankleY = 0.039 * height;
  return {
    crotchY,
    hipJointY,
    hipLowY: hipJointY - 1,
    hipY,
    waistY,
    underbustY,
    bustY,
    chestY,
    axillaY,
    shoulderY,
    neckBaseY,
    chinY,
    headTopY,
    kneeY,
    ankleY
  };
}
function buildTorsoKeys(profile, layout) {
  const hipRatio = (profile.sex === "female" ? 0.82 : profile.sex === "male" ? 0.76 : 0.79) + profile.seat * 0.04;
  const waistRatio = (profile.sex === "female" ? 0.7 : profile.sex === "male" ? 0.74 : 0.72) + profile.belly * 0.08;
  const bustRatio = profile.sex === "female" ? 0.8 + profile.bust_projection * 0.08 : profile.sex === "male" ? 0.74 : 0.77;
  const bustN = profile.sex === "female" ? 2.15 : profile.sex === "male" ? 2.35 : 2.25;
  const hipBias = -0.06 - profile.seat * 0.12 - profile.posture * 0.02;
  const waistBias = -0.02 + profile.belly * 0.14 + profile.posture * 0.02;
  const bustBias = (profile.sex === "female" ? 0.02 + profile.bust_projection * 0.14 : 0.02) + profile.posture * 0.03;
  const chestBias = 0.02 + profile.posture * 0.02;
  return [
    {
      y: layout.hipLowY,
      circumference: profile.hips_cm * 0.98,
      ratio: hipRatio,
      n: 2.2,
      frontBias: hipBias,
      region: "hip_low"
    },
    {
      y: layout.hipY,
      circumference: profile.hips_cm,
      ratio: hipRatio,
      n: 2.2,
      frontBias: hipBias,
      region: "hip"
    },
    {
      y: layout.waistY,
      circumference: profile.waist_cm,
      ratio: waistRatio,
      n: 2.2,
      frontBias: waistBias,
      region: "waist"
    },
    {
      y: layout.underbustY,
      circumference: profile.underbust_cm,
      ratio: 0.735,
      n: 2.25,
      frontBias: 0.01,
      region: "underbust"
    },
    {
      y: layout.bustY,
      circumference: profile.bust_cm,
      ratio: bustRatio,
      n: bustN,
      frontBias: bustBias,
      region: "bust"
    },
    {
      y: layout.chestY,
      circumference: profile.bust_cm * 0.98,
      ratio: 0.75,
      n: 2.35,
      frontBias: chestBias,
      region: "chest"
    },
    {
      y: layout.axillaY,
      circumference: profile.bust_cm * 0.94,
      ratio: 0.72,
      n: 2.3,
      frontBias: 0,
      region: "axilla"
    }
  ];
}
function interpolateTorsoKey(keys, y) {
  if (y <= keys[0].y) return { ...keys[0], y };
  if (y >= keys[keys.length - 1].y) return { ...keys[keys.length - 1], y };
  let index = 0;
  while (index < keys.length - 1 && keys[index + 1].y < y) index += 1;
  const a = keys[index];
  const b = keys[index + 1];
  const t = smoothstep((y - a.y) / (b.y - a.y));
  return {
    y,
    circumference: lerp(a.circumference, b.circumference, t),
    ratio: lerp(a.ratio, b.ratio, t),
    n: lerp(a.n, b.n, t),
    frontBias: lerp(a.frontBias, b.frontBias, t),
    region: t < 0.5 ? a.region : b.region
  };
}
function buildTorso(profile, layout, warnings) {
  const keys = buildTorsoKeys(profile, layout);
  const samples = [];
  const perGap = 3;
  for (let i = 0; i < keys.length - 1; i += 1) {
    for (let j = 0; j < perGap; j += 1) {
      samples.push(lerp(keys[i].y, keys[i + 1].y, j / perGap));
    }
  }
  samples.push(keys[keys.length - 1].y);
  const torso = [];
  for (const y of samples) {
    const key = interpolateTorsoKey(keys, y);
    torso.push(
      ringFromCircumference(y, key.circumference, key.ratio, key.n, key.region, 0, key.frontBias)
    );
  }
  const chestIndex = torso.findIndex((ring) => Math.abs(ring.y - layout.chestY) < 1e-6);
  if (chestIndex >= 0) {
    const chest = ringFromWidth(
      layout.chestY,
      profile.back_width_cm,
      profile.bust_cm * 0.98,
      0.75,
      2.35,
      "chest",
      0.02 + profile.posture * 0.02
    );
    if (Math.abs(chest.rx * 2 - profile.back_width_cm) > 1) {
      warnings.push({
        code: "back_width_adjusted",
        message: `El ancho de espalda (${profile.back_width_cm.toFixed(1)} cm) no cabe en el contorno de pecho; se ajusta a ${(chest.rx * 2).toFixed(1)} cm.`,
        severity: "info"
      });
    }
    torso[chestIndex] = chest;
  }
  const axilla = torso[torso.length - 1];
  const shoulderRx = profile.shoulder_cm / 2 * 0.82;
  const shoulderRz = Math.max(axilla.rz * 0.72, shoulderRx * 0.52);
  const shoulderN = 2.5;
  for (let i = 1; i <= 3; i += 1) {
    const t = i / 4;
    const s = smoothstep(t);
    torso.push(
      directRing(
        lerp(layout.axillaY, layout.shoulderY, t),
        lerp(axilla.rx, shoulderRx, s),
        lerp(axilla.rz, shoulderRz, s),
        lerp(axilla.n, shoulderN, s),
        "shoulder"
      )
    );
  }
  torso.push(directRing(layout.shoulderY, shoulderRx, shoulderRz, shoulderN, "shoulder"));
  const neckBase = ringFromCircumference(
    layout.neckBaseY,
    profile.neck_cm,
    0.9,
    2,
    "neck",
    0,
    0.01
  );
  const shoulder = torso[torso.length - 1];
  for (let i = 1; i <= 2; i += 1) {
    const t = i / 3;
    const s = smoothstep(t);
    torso.push(
      directRing(
        lerp(layout.shoulderY, layout.neckBaseY, t),
        lerp(shoulder.rx, neckBase.rx, s),
        lerp(shoulder.rz, neckBase.rz, s),
        lerp(shoulder.n, neckBase.n, s),
        "neck"
      )
    );
  }
  torso.push(neckBase);
  return torso;
}
function buildLeg(profile, layout, side) {
  const hipJointX = (profile.sex === "female" ? 0.05 : profile.sex === "male" ? 0.046 : 0.048) * profile.height_cm;
  const kneeX = hipJointX * 0.94;
  const ankleX = hipJointX * 0.84;
  const hip = vec(side * hipJointX, layout.hipJointY, 0);
  const knee = vec(side * kneeX, layout.kneeY, 0.5);
  const ankle = vec(side * ankleX, layout.ankleY, 0);
  const xAt = (y) => {
    if (y >= layout.kneeY) {
      const t2 = (layout.hipJointY - y) / (layout.hipJointY - layout.kneeY);
      return side * lerp(hipJointX, kneeX, clamp2(t2, 0, 1));
    }
    const t = (layout.kneeY - y) / (layout.kneeY - layout.ankleY);
    return side * lerp(kneeX, ankleX, clamp2(t, 0, 1));
  };
  const zAt = (y) => {
    if (y >= layout.kneeY) {
      const t2 = (layout.hipJointY - y) / (layout.hipJointY - layout.kneeY);
      return lerp(0, 0.5, clamp2(t2, 0, 1));
    }
    const t = (layout.kneeY - y) / (layout.kneeY - layout.ankleY);
    return lerp(0.5, 0, clamp2(t, 0, 1));
  };
  const calfY = lerp(layout.kneeY, layout.ankleY, 0.45);
  const keyData = [
    { y: layout.hipJointY, c: profile.thigh_cm * 1.02, ratio: 0.95, region: "thigh", frontBias: 0 },
    {
      y: lerp(layout.hipJointY, layout.kneeY, 0.15),
      c: profile.thigh_cm,
      ratio: 0.95,
      region: "thigh",
      frontBias: 0
    },
    {
      y: lerp(layout.hipJointY, layout.kneeY, 0.55),
      c: profile.thigh_cm * 0.88,
      ratio: 0.95,
      region: "thigh",
      frontBias: 0
    },
    {
      y: lerp(layout.hipJointY, layout.kneeY, 0.85),
      c: profile.thigh_cm * 0.68,
      ratio: 0.93,
      region: "thigh",
      frontBias: 0
    },
    {
      y: layout.kneeY,
      c: Math.max(profile.calf_cm * 0.95, profile.thigh_cm * 0.6),
      ratio: 0.92,
      region: "knee",
      frontBias: 0.04
    },
    { y: calfY, c: profile.calf_cm, ratio: 0.9, region: "calf", frontBias: -0.08 },
    {
      y: lerp(layout.kneeY, layout.ankleY, 0.85),
      c: profile.calf_cm * 0.78,
      ratio: 0.88,
      region: "calf",
      frontBias: -0.04
    },
    {
      y: layout.ankleY,
      c: profile.ankle_cm,
      ratio: 0.86,
      region: "ankle",
      frontBias: 0
    }
  ];
  const rings = keyData.map((key) => {
    const { rx, rz } = solveRxForCircumference(key.c, key.ratio, 2.05);
    return {
      center: vec(xAt(key.y), key.y, zAt(key.y) + rz * key.frontBias),
      u: vec(1, 0, 0),
      v: vec(0, 0, 1),
      rx,
      rz,
      n: 2.05,
      circumference_cm: key.c,
      region: key.region
    };
  });
  return {
    name: side < 0 ? "left_leg" : "right_leg",
    kind: "leg",
    side,
    joints: { hip, knee, ankle },
    rings
  };
}
function buildArm(profile, layout, side) {
  const shoulderJointX = profile.shoulder_cm / 2 * 0.84;
  const shoulderJointY = layout.shoulderY;
  const armLength = profile.arm_cm;
  const angle = 28 * Math.PI / 180;
  const shoulder = vec(side * shoulderJointX, shoulderJointY, 0);
  const elbow = vec(
    side * (shoulderJointX + armLength * 0.52 * Math.sin(angle)),
    shoulderJointY - armLength * 0.52 * Math.cos(angle),
    0.025 * armLength
  );
  const wrist = vec(
    side * (shoulderJointX + armLength * Math.sin(angle)),
    shoulderJointY - armLength * Math.cos(angle),
    0.02 * armLength
  );
  const pathAt = (t) => {
    if (t <= 0.52) return lerpVec(shoulder, elbow, t / 0.52);
    return lerpVec(elbow, wrist, (t - 0.52) / 0.48);
  };
  const circumferenceKeys = [
    { t: 0, c: profile.upper_arm_cm * 1.12 },
    { t: 0.15, c: profile.upper_arm_cm },
    { t: 0.45, c: profile.upper_arm_cm * 0.92 },
    { t: 0.52, c: profile.upper_arm_cm * 0.86 },
    { t: 0.65, c: profile.upper_arm_cm * 0.84 },
    { t: 0.85, c: profile.upper_arm_cm * 0.72 },
    { t: 1, c: profile.wrist_cm }
  ];
  const circumferenceAt = (t) => {
    if (t <= circumferenceKeys[0].t) return circumferenceKeys[0].c;
    const last = circumferenceKeys[circumferenceKeys.length - 1];
    if (t >= last.t) return last.c;
    let index = 0;
    while (index < circumferenceKeys.length - 1 && circumferenceKeys[index + 1].t < t) {
      index += 1;
    }
    const a = circumferenceKeys[index];
    const b = circumferenceKeys[index + 1];
    const s = smoothstep((t - a.t) / (b.t - a.t));
    return lerp(a.c, b.c, s);
  };
  const rings = [];
  const ringCount = 14;
  for (let i = 0; i < ringCount; i += 1) {
    const t = i / (ringCount - 1);
    const center = pathAt(t);
    const previous = pathAt(Math.max(0, t - 0.01));
    const next = pathAt(Math.min(1, t + 0.01));
    const axis = normalize(sub(next, previous));
    let u = normalize(cross(axis, vec(0, 0, 1)));
    if (lengthOf(u) < 1e-6) u = vec(1, 0, 0);
    const v = normalize(cross(axis, u));
    const circumference = circumferenceAt(t);
    const { rx, rz } = solveRxForCircumference(circumference, 0.92, 2);
    rings.push({
      center,
      u,
      v,
      rx,
      rz,
      n: 2,
      circumference_cm: circumference,
      region: t >= 0.98 ? "wrist" : t < 0.52 ? "arm" : "forearm"
    });
  }
  return {
    name: side < 0 ? "left_arm" : "right_arm",
    kind: "arm",
    side,
    joints: { shoulder, elbow, wrist },
    rings
  };
}
function buildNeck(profile, layout) {
  const rings = [];
  const count = 5;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const y = lerp(layout.neckBaseY, layout.chinY, t);
    const circumference = lerp(profile.neck_cm, profile.neck_cm * 0.92, smoothstep(t));
    rings.push(ringFromCircumference(y, circumference, 0.9, 2, "neck", 0, 0.01));
  }
  return rings;
}
function buildHead(profile, layout) {
  const headHeight = layout.headTopY - layout.chinY;
  return {
    center: vec(0, layout.chinY + headHeight / 2, 5e-3 * profile.height_cm),
    rx: 0.045 * profile.height_cm,
    ry: headHeight / 2,
    rz: 0.055 * profile.height_cm,
    n: 2.2
  };
}
function buildFoot(profile, leg) {
  const footLength = 0.15 * profile.height_cm;
  const footWidth = 0.055 * profile.height_cm;
  const footHeight = 0.035 * profile.height_cm;
  return {
    side: leg.side,
    center: vec(
      leg.joints.ankle.x,
      footHeight / 2,
      footLength / 2 - 0.02 * profile.height_cm
    ),
    rx: footWidth / 2,
    ry: footHeight / 2,
    rz: footLength / 2,
    n: 2.2
  };
}
function buildHand(profile, arm) {
  const axis = normalize(sub(arm.joints.wrist, arm.joints.elbow));
  const handLength = 0.1 * profile.height_cm;
  return {
    side: arm.side,
    center: add(arm.joints.wrist, scale(axis, handLength / 2)),
    axis,
    length_cm: handLength,
    width_cm: 0.035 * profile.height_cm,
    thickness_cm: 0.018 * profile.height_cm
  };
}
function ringAtY(rings, y) {
  const ring = rings.find((candidate) => Math.abs(candidate.y - y) < 1e-6);
  if (!ring) throw new Error(`No hay anillo del torso en y=${y.toFixed(2)} cm`);
  return ring;
}
function buildLandmarks(profile, layout, torso) {
  const hip = ringAtY(torso, layout.hipY);
  const waist = ringAtY(torso, layout.waistY);
  const bust = ringAtY(torso, layout.bustY);
  const chest = ringAtY(torso, layout.chestY);
  return {
    height_cm: profile.height_cm,
    head_top_y_cm: layout.headTopY,
    chin_y_cm: layout.chinY,
    neck_base_y_cm: layout.neckBaseY,
    shoulder_y_cm: layout.shoulderY,
    axilla_y_cm: layout.axillaY,
    bust_y_cm: layout.bustY,
    chest_y_cm: layout.chestY,
    underbust_y_cm: layout.underbustY,
    waist_y_cm: layout.waistY,
    hip_y_cm: layout.hipY,
    crotch_y_cm: layout.crotchY,
    knee_y_cm: layout.kneeY,
    ankle_y_cm: layout.ankleY,
    shoulder_width_cm: profile.shoulder_cm,
    hip_width_cm: hip.rx * 2,
    waist_width_cm: waist.rx * 2,
    bust_width_cm: bust.rx * 2,
    chest_depth_cm: chest.rz * 2,
    arm_length_cm: profile.arm_cm,
    leg_length_cm: layout.crotchY,
    torso_length_cm: profile.torso_length_cm
  };
}
function assertFinite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`Geometr\xEDa no finita en ${label}: ${value}`);
}
function validateGeometry(torso, neck, legs, arms, head, feet, hands) {
  if (torso.length < 10) throw new Error("El torso necesita al menos 10 anillos");
  if (neck.length < 2) throw new Error("El cuello necesita al menos 2 anillos");
  for (let i = 0; i < torso.length; i += 1) {
    const ring = torso[i];
    assertFinite(ring.y, `torso[${i}].y`);
    assertFinite(ring.rx, `torso[${i}].rx`);
    assertFinite(ring.rz, `torso[${i}].rz`);
    assertFinite(ring.cz, `torso[${i}].cz`);
    assertFinite(ring.n, `torso[${i}].n`);
    assertFinite(ring.cx, `torso[${i}].cx`);
    if (ring.rx <= 0 || ring.rz <= 0) {
      throw new Error(`Anillo del torso no positivo en y=${ring.y}: rx=${ring.rx}, rz=${ring.rz}`);
    }
    if (i > 0 && ring.y <= torso[i - 1].y) {
      throw new Error(`Anillos del torso desordenados: ${torso[i - 1].y} \u2192 ${ring.y}`);
    }
    const actual = superellipsePerimeter(ring.rx, ring.rz, ring.n);
    const tolerance = Math.max(0.5, ring.circumference_cm * 5e-3);
    if (Math.abs(actual - ring.circumference_cm) > tolerance) {
      throw new Error(
        `Circunferencia mal reproducida en ${ring.region} y=${ring.y.toFixed(2)}: objetivo ${ring.circumference_cm.toFixed(2)}, real ${actual.toFixed(2)}`
      );
    }
  }
  for (const ring of neck) {
    assertFinite(ring.y, "neck.y");
    assertFinite(ring.rx, "neck.rx");
    assertFinite(ring.rz, "neck.rz");
  }
  for (const limb of [...legs, ...arms]) {
    if (limb.rings.length < 4) throw new Error(`${limb.name} necesita al menos 4 anillos`);
    for (let i = 0; i < limb.rings.length; i += 1) {
      const ring = limb.rings[i];
      assertFinite(ring.center.x, `${limb.name}.center.x`);
      assertFinite(ring.center.y, `${limb.name}.center.y`);
      assertFinite(ring.center.z, `${limb.name}.center.z`);
      assertFinite(ring.rx, `${limb.name}.rx`);
      assertFinite(ring.rz, `${limb.name}.rz`);
      if (ring.rx <= 0 || ring.rz <= 0) {
        throw new Error(`${limb.name} tiene un anillo no positivo`);
      }
      if (i > 0 && ring.center.y >= limb.rings[i - 1].center.y) {
        throw new Error(
          `${limb.name}: anillos desordenados en Y (${limb.rings[i - 1].center.y.toFixed(2)} \u2192 ${ring.center.y.toFixed(2)})`
        );
      }
    }
  }
  for (const value of [head.center.y, head.rx, head.ry, head.rz, head.n]) {
    assertFinite(value, "head");
  }
  for (const foot of feet) {
    for (const value of [foot.center.y, foot.rx, foot.ry, foot.rz, foot.n]) {
      assertFinite(value, "foot");
    }
  }
  for (const hand of hands) {
    for (const value of [hand.length_cm, hand.width_cm, hand.thickness_cm]) {
      assertFinite(value, "hand");
    }
  }
}
function buildBody(profileInput) {
  const profile = resolveBodyProfile(profileInput);
  const warnings = [...profile.warnings];
  const layout = computeTorsoLayout(profile);
  if (layout.crotchY < profile.inseam_cm - 1e-6) {
    warnings.push({
      code: "inseam_regularized",
      message: `Entrepierna ${profile.inseam_cm.toFixed(1)} cm > 55% de la altura; la geometr\xEDa usa ${layout.crotchY.toFixed(1)} cm para que la cadera quede por encima del crotch.`,
      severity: "warn"
    });
  }
  const torso = buildTorso(profile, layout, warnings);
  const legs = [buildLeg(profile, layout, -1), buildLeg(profile, layout, 1)];
  const arms = [buildArm(profile, layout, -1), buildArm(profile, layout, 1)];
  const neck = buildNeck(profile, layout);
  const head = buildHead(profile, layout);
  const feet = legs.map((leg) => buildFoot(profile, leg));
  const hands = arms.map((arm) => buildHand(profile, arm));
  const landmarks = buildLandmarks(profile, layout, torso);
  validateGeometry(torso, neck, legs, arms, head, feet, hands);
  const ringCount = torso.length + neck.length + legs.reduce((sum, leg) => sum + leg.rings.length, 0) + arms.reduce((sum, arm) => sum + arm.rings.length, 0);
  return {
    profile,
    torso,
    legs,
    arms,
    neck,
    head,
    feet,
    hands,
    landmarks,
    warnings,
    inferred: profile.inferred,
    confidence: profile.confidence,
    meta: {
      ring_count: ringCount,
      estimated_vertices: ringCount * 64 + 3 * 128,
      estimated_triangles: ringCount * 64 * 2 + 3 * 128
    }
  };
}
export {
  buildBody,
  superellipsePerimeter,
  superellipsePoint
};
