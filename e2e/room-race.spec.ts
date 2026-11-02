import { test } from "@playwright/test";
import { runRoomRace } from "./room-race.helpers";

test("un membre et un invité courent ensemble, puis le membre retrouve son résultat (SALLE-01, SALLE-02, JOIN-01, COURSE-01 à COURSE-04, COURSE-10, RES-01, RES-02, HIST-01, HIST-02)", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  await runRoomRace({ page, browser, baseURL });
});
