// Око Предела по рамке портала: вставить (бит TOP), и если кольцо из 12 рамок собрано — портал
// зажигается. Бросок Ока в воздух — Interaction (интент ThrowEye) и Game.
import { events } from "../../core/EventBus";
import { B } from "../../registry/Blocks";
import { TOP } from "../../registry/meta";
import { tryLightBeyondPortal } from "../BeyondPortal";
import { useItem } from "../itemUse";

useItem("rim_eye", (c) => {
  if (c.id !== B.rim_frame || c.meta & TOP) return false;
  c.world.setBlock(c.x, c.y, c.z, c.id, c.meta | TOP);
  c.consume();
  events.emit("eyePlaced", { x: c.x, y: c.y, z: c.z });
  if (tryLightBeyondPortal(c.world, c.x, c.y, c.z))
    events.emit("beyondPortalLit", { x: c.x, y: c.y, z: c.z });
  return true;
});
