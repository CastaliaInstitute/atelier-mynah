#pragma once

#include <Arduino.h>
#include <stdint.h>

bool pm_touch_begin();

/** Sample capacitive touch: returns point count 0..max_pts; fills xs/ys in screen coordinates. */
uint8_t pm_touch_sample(int16_t *xs, int16_t *ys, uint8_t max_pts);

/** True while at least one finger is in the lower PTT zone (see MYNAH_PTT_MIN_Y). */
bool pm_touch_held_in_ptt_zone();
