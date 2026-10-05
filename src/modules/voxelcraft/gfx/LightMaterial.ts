// Свет клеток в материалах чанков: атрибут вершины lightLevel = (1 - небо/15, блоки/15), его пишет
// мешер. Небесный свет гасит и солнце, и небосвод (пещеры тёмные даже днём), свет блоков
// добавляется тёплым (факел). Кривая яркости — 0.8 в степени «недостачи» уровня, как в Minecraft.
//
// Кодировка «недостача неба» выбрана нарочно: у мешей без атрибута (кубик в руке, дроп) WebGL
// подставляет 0 — это полное небо и ноль от блоков, то есть обычная яркость, а не чёрный.
import * as THREE from "three";

/** Цвет света от блоков (факел, лава). */
export const BLOCK_LIGHT_COLOR = new THREE.Color(1.0, 0.8, 0.55);

/**
 * Нижний порог рассеянного света без неба: наверху пещеры почти чёрные (0.03), в Пекле и Пределе
 * неба нет вовсе — там свой фоновый свет, как ambient-свет измерения в Minecraft (ставит DayNight).
 */
export const LIGHT_AMBIENT = { value: 0.03 };

export function patchLightMaterial(mat: THREE.MeshLambertMaterial): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBlockLightColor = { value: BLOCK_LIGHT_COLOR };
    shader.uniforms.uAmbient = LIGHT_AMBIENT;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec2 lightLevel;\nvarying vec2 vLightLevel;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvLightLevel = lightLevel;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vLightLevel;\nuniform vec3 uBlockLightColor;\nuniform float uAmbient;",
      )
      .replace(
        "#include <aomap_fragment>",
        [
          "#include <aomap_fragment>",
          "float vcSky = pow(0.8, vLightLevel.x * 15.0);",
          "float vcBlk = vLightLevel.y > 0.0 ? pow(0.8, (1.0 - vLightLevel.y) * 15.0) : 0.0;",
          "reflectedLight.directDiffuse *= vcSky;",
          "reflectedLight.indirectDiffuse *= max(vcSky, uAmbient);",
          "reflectedLight.indirectDiffuse += diffuseColor.rgb * uBlockLightColor * vcBlk;",
        ].join("\n"),
      );
  };
  // одна программа на все материалы с этим патчем
  mat.customProgramCacheKey = () => "vc-light";
}
