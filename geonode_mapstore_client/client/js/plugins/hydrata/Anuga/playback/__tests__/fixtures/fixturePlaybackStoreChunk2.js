// AUTO-GENERATED (TASK-2719, W8.1, epic 2706) — DO NOT HAND-EDIT.
//
// Regenerate with:
//   python3 playback-rig/make_chunk2_js_fixture.py       (in the deploy repo)
//   python3 playback-rig/make_chunk2_js_fixture.py --check   (drift gate)
//
// The SAME store as fixturePlaybackStore.js — same mesh, same physical
// values, same quantization attrs, byte-identical decoded rows — regrouped
// along the time axis into chunks of TWO timesteps by
// scripts/playback-rig/rechunk_playback_store.py, the same deploy-repo tool
// that produced the chunk-1 sibling fixture and the W0 rig's prod-scale
// stores.
//
// WHY IT EXISTS. Decision D5 (TASK-2719) floors the exporter's adaptive
// time-chunk length at 2, not 1 — chunk length 1 recreates the 2618
// client-side LRU thrash by construction (one static mesh array is 1.33x
// the whole chunk-1 cache ceiling). Chunk length 2 is what a run-1328-scale
// re-export actually writes once the exporter ships, so this fixture proves
// the client's chunk-shape-from-the-store machinery (TASK-2724) at the
// length production will really use, not just the pre-existing chunk-1
// backward-compat grid.
//
// 13 timesteps at chunk length 2 -> 7 chunks (0..6); the last chunk holds
// one real row (timestep 12) plus one fill row.

import { FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixturePlaybackStore';

// Re-exported so a test can assert against the same physical values through
// any of the three stores without importing them all separately.
export { FIXTURE_PHYSICAL, FIXTURE_MESH };

export const FIXTURE_STORE_FILES_CHUNK2 = {
    "depth/c/0/0": "H4sIAAAAAAAAA2NgQAAZdku+PuZQ0dVcDAwArxoryxgAAAA=",
    "depth/c/1/0": "H4sIAAAAAAAAA7PkK5KRYV+tFSrKwBAqulprNReDA4MCAwMAuuEXhRgAAAA=",
    "depth/c/2/0": "H4sIAAAAAAAAAyuSeWxhyRcaulqLgaFPWcb9uOCqrFBTBgYA3N+GohgAAAA=",
    "depth/c/3/0": "H4sIAAAAAAAAA1utFRoaKsrQwODAwHDcsC/5sUTo1FVeDAwAbkKA3xgAAAA=",
    "depth/c/4/0": "H4sIAAAAAAAAA3tscbywSGbVqtBQBgYGB4YGBoX/+xkSGBgAPtU5xRgAAAA=",
    "depth/c/5/0": "H4sIAAAAAAAAA5Nxt+jrUw69uiqLgcHSr3COjPqqV6GlDAwAfHpvGRgAAAA=",
    "depth/c/6/0": "H4sIAAAAAAAAAwsNXbVqtdb//wwNDCgAAHwaQWYYAAAA",
    "depth/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDIsCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLAogICJjb2RlY3MiOiBbCiAgICB7CiAgICAgICJuYW1lIjogImJ5dGVzIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImVuZGlhbiI6ICJsaXR0bGUiCiAgICAgIH0KICAgIH0sCiAgICB7CiAgICAgICJuYW1lIjogImd6aXAiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAibGV2ZWwiOiA2CiAgICAgIH0KICAgIH0KICBdLAogICJhdHRyaWJ1dGVzIjogewogICAgInNjYWxlIjogNS40OTMyNDc2NDYzMzg0ODFlLTA2LAogICAgIm9mZnNldCI6IDAuMCwKICAgICJxdWFudGl6ZWRfZHR5cGUiOiAidWludDE2IiwKICAgICJieXRlb3JkZXIiOiAibGl0dGxlIiwKICAgICJ2YWxpZF9taW4iOiAwLjAsCiAgICAidmFsaWRfbWF4IjogMC4zNTk5OTk5ODQ1MDI3OTIzNgogIH0sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImFycmF5IiwKICAic3RvcmFnZV90cmFuc2Zvcm1lcnMiOiBbXQp9",
    "dt_ms/c/0": "H4sIAAAAAAAAA2NgOFDPQCIGAMqiY/M0AAAA",
    "dt_ms/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzCiAgXSwKICAiZGF0YV90eXBlIjogImZsb2F0MzIiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEzCiAgICAgIF0KICAgIH0KICB9LAogICJjaHVua19rZXlfZW5jb2RpbmciOiB7CiAgICAibmFtZSI6ICJkZWZhdWx0IiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAic2VwYXJhdG9yIjogIi8iCiAgICB9CiAgfSwKICAiZmlsbF92YWx1ZSI6ICJOYU4iLAogICJjb2RlY3MiOiBbCiAgICB7CiAgICAgICJuYW1lIjogImJ5dGVzIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImVuZGlhbiI6ICJsaXR0bGUiCiAgICAgIH0KICAgIH0sCiAgICB7CiAgICAgICJuYW1lIjogImd6aXAiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAibGV2ZWwiOiA2CiAgICAgIH0KICAgIH0KICBdLAogICJhdHRyaWJ1dGVzIjoge30sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImFycmF5IiwKICAic3RvcmFnZV90cmFuc2Zvcm1lcnMiOiBbXQp9",
    "elevation/c/0": "H4sIANdSdGoA/2NgYGA4e+aM7dkzPnZAbDtrpqQdA0ODHQCA//NJGAAAAA==",
    "elevation/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "face_node_connectivity/c/0/0": "H4sIANdSdGoA/2NgYGBgBGJmKM2CxGaC8kE0K5QNAGeqW6AwAAAA",
    "face_node_connectivity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDQsCiAgICAzCiAgXSwKICAiZGF0YV90eXBlIjogImludDMyIiwKICAiY2h1bmtfZ3JpZCI6IHsKICAgICJuYW1lIjogInJlZ3VsYXIiLAogICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICJjaHVua19zaGFwZSI6IFsKICAgICAgICA0LAogICAgICAgIDMKICAgICAgXQogICAgfQogIH0sCiAgImNodW5rX2tleV9lbmNvZGluZyI6IHsKICAgICJuYW1lIjogImRlZmF1bHQiLAogICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICJzZXBhcmF0b3IiOiAiLyIKICAgIH0KICB9LAogICJmaWxsX3ZhbHVlIjogLTEsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "friction/c/0": "H4sIANdSdGoA/+O6rmzLhQUDAOjpqJ4YAAAA",
    "friction/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "inradius/c/0": "H4sIANdSdGoA/yu7KeZQAsTlQFwMxAB4eIXWEAAAAA==",
    "inradius/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDQKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNAogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "node_x/c/0": "H4sIANdSdGoA/2NgAAEFRwaGBY4MSGwAk7qIxxgAAAA=",
    "node_x/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "node_y/c/0": "H4sIANdSdGoA/2NgQAYKjjAMAN//FdMYAAAA",
    "node_y/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "time/c/0": "H4sIANdSdGoA/2NgQAZ2DhDaD0I3hEH5cRD6QBJUPA1CO2RB5fMg9IMCqLoiCL2gBKq+zAEAno/I/GgAAAA=",
    "time/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzCiAgXSwKICAiZGF0YV90eXBlIjogImZsb2F0NjQiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEzCiAgICAgIF0KICAgIH0KICB9LAogICJjaHVua19rZXlfZW5jb2RpbmciOiB7CiAgICAibmFtZSI6ICJkZWZhdWx0IiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAic2VwYXJhdG9yIjogIi8iCiAgICB9CiAgfSwKICAiZmlsbF92YWx1ZSI6IDAuMCwKICAiY29kZWNzIjogWwogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHt9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "x_velocity/c/0/0": "H4sIAAAAAAAAA/tf/x8Od/1b+1/o963/uf//1wMAaRwvvhgAAAA=",
    "x_velocity/c/1/0": "H4sIAAAAAAAAA1v7/9X/Xf++/r/1/3/9rf9f/+f+//X/HZANAKL58wcYAAAA",
    "x_velocity/c/2/0": "H4sIAAAAAAAAA3v1/+f/tf///P/6/3/9x/+//5/6//f/DyAbAA7Dm4gYAAAA",
    "x_velocity/c/3/0": "H4sIAAAAAAAAA/v6/8//W////v/1/3/9DyD95P+//7+BbAC4izj4GAAAAA==",
    "x_velocity/c/4/0": "H4sIAAAAAAAAA/v5/+//V////f/z/3/9LyD7HZQNAN+4GvcYAAAA",
    "x_velocity/c/5/0": "H4sIAAAAAAAAA/v9/+//j///Acn/9X+A9GcoGwBgiPUJGAAAAA==",
    "x_velocity/c/6/0": "H4sIAAAAAAAAA/vz/9//r0D89///emQIAJE6rygYAAAA",
    "x_velocity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDIsCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAzMjc2NywKICAiY29kZWNzIjogWwogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHsKICAgICJzY2FsZSI6IDkuMTU1NDgzMTczMzc4ODZlLTA2LAogICAgIm9mZnNldCI6IC0wLjI5OTk5NzcxNzE0MjEwNTEsCiAgICAicXVhbnRpemVkX2R0eXBlIjogInVpbnQxNiIsCiAgICAiYnl0ZW9yZGVyIjogImxpdHRsZSIsCiAgICAidmFsaWRfbWluIjogLTAuMjk5OTk3NzE3MTQyMTA1MSwKICAgICJ2YWxpZF9tYXgiOiAwLjI5OTk5NzcxNzE0MjEwNTEKICB9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "y_velocity/c/0/0": "H4sIAAAAAAAAA/tf/x8Om7Qfan3SPaTFrf2/HgDArYp5GAAAAA==",
    "y_velocity/c/1/0": "H4sIAAAAAAAAA3uotUOrSXuD1iGt//WHtDZocWuv1doKZAMAwOJDPhgAAAA=",
    "y_velocity/c/2/0": "H4sIAAAAAAAAA9uhtU7rodYarQ1a/+s3A+mzWquBIv/rAY16ixsYAAAA",
    "y_velocity/c/3/0": "H4sIAAAAAAAAA9ugtUbrkNZqrbVa/+vXA+k9QLwGyAYAUAb9fRgAAAA=",
    "y_velocity/c/4/0": "H4sIAAAAAAAAA1untVprBxCv0fpfvxZIb9VaBST/1wMA/C0/lhgAAAA=",
    "y_velocity/c/5/0": "H4sIAAAAAAAAA1ujtVprs9YqIPm/fg2Q3AhlAwCKdjJwGAAAAA==",
    "y_velocity/c/6/0": "H4sIAAAAAAAAA1ujtVprg9YqIPm/HhkCAE9b/9oYAAAA",
    "y_velocity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDIsCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAzMjc2NywKICAiY29kZWNzIjogWwogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHsKICAgICJzY2FsZSI6IDkuMTU1NDgzMTczMzc4ODZlLTA2LAogICAgIm9mZnNldCI6IC0wLjI5OTk5NzcxNzE0MjEwNTEsCiAgICAicXVhbnRpemVkX2R0eXBlIjogInVpbnQxNiIsCiAgICAiYnl0ZW9yZGVyIjogImxpdHRsZSIsCiAgICAidmFsaWRfbWluIjogLTAuMjk5OTk3NzE3MTQyMTA1MSwKICAgICJ2YWxpZF9tYXgiOiAwLjI5OTk5NzcxNzE0MjEwNTEKICB9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "zarr.json": "ewogICJhdHRyaWJ1dGVzIjogewogICAgImZvcm1hdF92ZXJzaW9uIjogMSwKICAgICJ4bGxjb3JuZXIiOiA1MDAwMDAuMCwKICAgICJ5bGxjb3JuZXIiOiA2OTAwMDAwLjAsCiAgICAiZmFsc2VfZWFzdGluZyI6IDUwMDAwMC4wLAogICAgImZhbHNlX25vcnRoaW5nIjogMTAwMDAwMDAuMCwKICAgICJlcHNnIjogMzI3NTYsCiAgICAiem9uZSI6IDU2LAogICAgInZlbG9jaXR5X2NvbnZlbnRpb24iOiAic29sdmVyX2Vwc2lsb24iLAogICAgInZlbG9jaXR5X2Zvcm11bGEiOiAidSA9IHVoIC8gKGggKyBoMC9oKSIsCiAgICAidmVsb2NpdHlfcHJvdGVjdGlvbiI6IDFlLTA2LAogICAgIm1pbmltdW1fYWxsb3dlZF9oZWlnaHQiOiAxZS0wNSwKICAgICJkaXNwbGF5X21hc2tfaCI6IDFlLTA1LAogICAgIm1pbmltdW1fc3RvcmFibGVfaGVpZ2h0IjogMC4wMDUsCiAgICAiZyI6IDkuOCwKICAgICJyaG9fdyI6IDEwMjMuMCwKICAgICJidWlsZGluZ19tYW5uaW5nc19uIjogMTAuMCwKICAgICJmbG93X2FsZ29yaXRobSI6ICJERTAiLAogICAgIm1vZGVsX3N0YXJ0IjogIjE5NzAtMDEtMDFUMDA6MDA6MDArMDA6MDAiLAogICAgInRpbWVfdW5pdHMiOiAic2Vjb25kcyIsCiAgICAiaGFzX2R0IjogZmFsc2UsCiAgICAiZHRfc291cmNlIjogbnVsbCwKICAgICJzbW9vdGhpbmciOiAidmVydGV4LWF2ZXJhZ2VkIiwKICAgICJhbnVnYV92ZXJzaW9uIjogIjMuMy43LWZpeHR1cmUiLAogICAgInJldmlzaW9uX251bWJlciI6ICJmaXh0dXJlIiwKICAgICJyZXZpc2lvbl9kYXRlIjogImZpeHR1cmUiLAogICAgImNvZGVjIjogImd6aXAiLAogICAgImNvZGVjX2xldmVsIjogNgogIH0sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImdyb3VwIgp9"
};

export const FIXTURE_MANIFEST_CHUNK2 = {
    "bucket": "fixture-bucket",
    "prefix": "playback/fixture_project_fixture_scenario_fixture_run_chunk2/",
    "chunk_urls": {
        "depth/c/0/0": "depth/c/0/0",
        "depth/c/1/0": "depth/c/1/0",
        "depth/c/2/0": "depth/c/2/0",
        "depth/c/3/0": "depth/c/3/0",
        "depth/c/4/0": "depth/c/4/0",
        "depth/c/5/0": "depth/c/5/0",
        "depth/c/6/0": "depth/c/6/0",
        "depth/zarr.json": "depth/zarr.json",
        "dt_ms/c/0": "dt_ms/c/0",
        "dt_ms/zarr.json": "dt_ms/zarr.json",
        "elevation/c/0": "elevation/c/0",
        "elevation/zarr.json": "elevation/zarr.json",
        "face_node_connectivity/c/0/0": "face_node_connectivity/c/0/0",
        "face_node_connectivity/zarr.json": "face_node_connectivity/zarr.json",
        "friction/c/0": "friction/c/0",
        "friction/zarr.json": "friction/zarr.json",
        "inradius/c/0": "inradius/c/0",
        "inradius/zarr.json": "inradius/zarr.json",
        "node_x/c/0": "node_x/c/0",
        "node_x/zarr.json": "node_x/zarr.json",
        "node_y/c/0": "node_y/c/0",
        "node_y/zarr.json": "node_y/zarr.json",
        "time/c/0": "time/c/0",
        "time/zarr.json": "time/zarr.json",
        "x_velocity/c/0/0": "x_velocity/c/0/0",
        "x_velocity/c/1/0": "x_velocity/c/1/0",
        "x_velocity/c/2/0": "x_velocity/c/2/0",
        "x_velocity/c/3/0": "x_velocity/c/3/0",
        "x_velocity/c/4/0": "x_velocity/c/4/0",
        "x_velocity/c/5/0": "x_velocity/c/5/0",
        "x_velocity/c/6/0": "x_velocity/c/6/0",
        "x_velocity/zarr.json": "x_velocity/zarr.json",
        "y_velocity/c/0/0": "y_velocity/c/0/0",
        "y_velocity/c/1/0": "y_velocity/c/1/0",
        "y_velocity/c/2/0": "y_velocity/c/2/0",
        "y_velocity/c/3/0": "y_velocity/c/3/0",
        "y_velocity/c/4/0": "y_velocity/c/4/0",
        "y_velocity/c/5/0": "y_velocity/c/5/0",
        "y_velocity/c/6/0": "y_velocity/c/6/0",
        "y_velocity/zarr.json": "y_velocity/zarr.json",
        "zarr.json": "zarr.json"
    },
    "schema_metadata": {
        "format_version": 2,
        "n_node": 6,
        "n_time": 13,
        "chunk_length_t": 2,
        "xllcorner": 500000.0,
        "yllcorner": 6900000.0,
        "false_easting": 500000.0,
        "false_northing": 10000000.0,
        "epsg": 32756,
        "zone": 56,
        "velocity_convention": "solver_epsilon",
        "velocity_formula": "u = uh / (h + h0/h)",
        "velocity_protection": 1e-06,
        "minimum_allowed_height": 1e-05,
        "display_mask_h": 1e-05,
        "minimum_storable_height": 0.005,
        "g": 9.8,
        "rho_w": 1023.0,
        "building_mannings_n": 10.0,
        "flow_algorithm": "DE0",
        "model_start": "1970-01-01T00:00:00+00:00",
        "time_units": "seconds",
        "has_dt": false,
        "dt_source": null,
        "smoothing": "vertex-averaged",
        "anuga_version": "3.3.7-fixture",
        "revision_number": "fixture",
        "revision_date": "fixture",
        "codec": "gzip",
        "codec_level": 6
    },
    "quantization": {
        "depth": {
            "scale": 5.493247646338481e-06,
            "offset": 0.0,
            "quantized_dtype": "uint16",
            "byteorder": "little",
            "valid_min": 0.0,
            "valid_max": 0.35999998450279236
        },
        "x_velocity": {
            "scale": 9.15548317337886e-06,
            "offset": -0.2999977171421051,
            "quantized_dtype": "uint16",
            "byteorder": "little",
            "valid_min": -0.2999977171421051,
            "valid_max": 0.2999977171421051
        },
        "y_velocity": {
            "scale": 9.15548317337886e-06,
            "offset": -0.2999977171421051,
            "quantized_dtype": "uint16",
            "byteorder": "little",
            "valid_min": -0.2999977171421051,
            "valid_max": 0.2999977171421051
        }
    },
    "chunk_shapes": {
        "depth": [
            2,
            6
        ],
        "x_velocity": [
            2,
            6
        ],
        "y_velocity": [
            2,
            6
        ]
    },
    "expires_at": "2026-08-06T23:59:59+00:00"
};
