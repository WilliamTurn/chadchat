# FIX-33 dedup demonstration against real prod data (READ-ONLY)

Generated 2026-07-14T00:46:22.283Z by scripts/p56b-dedup-demo.ts. No writes; SELECTs only.

Approved ExerciseAlias rows in prod: 0 (resolution therefore runs on member customs + the curated set, exactly what the live pages consume).

## Member cl***@example.com (6 workouts)

Records BEFORE wiring (raw names): 3 rows -> Overhead Press, Tricep Pushdown, Barbell Bench Press

Records AFTER wiring (canonical, what /workouts and /progress/training now render): 3 rows -> Overhead Press, Tricep Pushdown, Barbell Bench Press

Merged away: 0 split rows. PR timeline events (source-linked): 0.


## Member jo***@gmail.com (5 workouts)

Records BEFORE wiring (raw names): 10 rows -> Seated Calf Raise, Leg Press, Bulgarian Split Squat, Lying Leg Curl, Incline Dumbbell Press, Push-Up, Barbell Bench Press, Burpee, Calf Raise, Deadlift

Records AFTER wiring (canonical, what /workouts and /progress/training now render): 10 rows -> Seated Calf Raise, Leg Press, Bulgarian Split Squat, Leg Curl, Incline Dumbbell Press, Push-Up, Barbell Bench Press, Burpee, Calf Raise, Deadlift

Merged away: 0 split rows. PR timeline events (source-linked): 0.

- **Leg Curl**: absorbed "Lying Leg Curl" (best 150 lb); reconciled best = 150 lb, est. 1RM 200 lb, source workout 677e01a5-e2fa-49dc-af67-66de3a8efb6c

## Member st***@gmail.com (32 workouts)

Records BEFORE wiring (raw names): 22 rows -> Leg Press, Barbell Hip Thrust, Deadlift, Standing Calf Raise, Back Squat, Romanian Deadlift, Bench Press, Barbell Row, Seated Cable Row, Front Squat, Lat Pulldown, Seated Leg Curl, Overhead Press, Barbell Curl, Dumbbell Bench Press, Cable Triceps Pushdown, Incline Dumbbell Press, Face Pull, Bulgarian Split Squat, Weighted Pull-Up, Lateral Raise, Hanging Leg Raise

Records AFTER wiring (canonical, what /workouts and /progress/training now render): 22 rows -> Leg Press, Hip Thrust, Deadlift, Calf Raise, Barbell Back Squat, Romanian Deadlift, Barbell Bench Press, Barbell Row, Seated Cable Row, Front Squat, Lat Pulldown, Leg Curl, Overhead Press, Barbell Curl, Dumbbell Bench Press, Cable Triceps Pushdown, Incline Dumbbell Press, Face Pull, Bulgarian Split Squat, Weighted Pull-Up, Lateral Raise, Hanging Leg Raise

Merged away: 0 split rows. PR timeline events (source-linked): 110.

- **Hip Thrust**: absorbed "Barbell Hip Thrust" (best 385 lb); reconciled best = 385 lb, est. 1RM 513 lb, source workout 4a0f516f-322c-4508-b915-99657a7b924f
- **Calf Raise**: absorbed "Standing Calf Raise" (best 265 lb); reconciled best = 265 lb, est. 1RM 371 lb, source workout bf9f2b88-bd2d-4cd6-a953-a1ef6b7a0659
- **Barbell Back Squat**: absorbed "Back Squat" (best 315 lb); reconciled best = 315 lb, est. 1RM 368 lb, source workout bf9f2b88-bd2d-4cd6-a953-a1ef6b7a0659
- **Barbell Bench Press**: absorbed "Bench Press" (best 230 lb); reconciled best = 230 lb, est. 1RM 268 lb, source workout a09442cd-6a3f-427f-b4bb-706e08ebebc2
- **Leg Curl**: absorbed "Seated Leg Curl" (best 130 lb); reconciled best = 130 lb, est. 1RM 182 lb, source workout bf9f2b88-bd2d-4cd6-a953-a1ef6b7a0659
