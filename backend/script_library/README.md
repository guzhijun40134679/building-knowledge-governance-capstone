Script-library directory for deterministic workflow copy; these messages do not call an AI model.

Two layouts are supported:
1) One file at the root: `intent.txt` (one message per line)
   Example: `initial_topic_prompt.txt`

2) Multiple files in a subdirectory: `intent/*.txt` (one message per file)
   Example: `electric_region_prompt/1.txt`, `electric_region_prompt/2.txt`

Currently used intents:
- initial_topic_prompt
- electric_region_prompt
- electric_region_retry
- electric_region_nj_confirm
- electric_region_manhattan_confirm
- electric_no_doc

After editing, reload with:
- POST /scripts/reload
You can also refresh the frontend; the library loads automatically when the backend restarts.
