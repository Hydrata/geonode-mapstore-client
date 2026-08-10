// AUTO-GENERATED (TASK-2724, W1.3, epic 2706) — DO NOT HAND-EDIT.
//
// Regenerate with:
//   python3 playback-rig/make_chunk1_js_fixture.py       (in the deploy repo)
//   python3 playback-rig/make_chunk1_js_fixture.py --check   (drift gate)
//
// The SAME store as fixturePlaybackStore.js — same mesh, same physical
// values, same quantization attrs, byte-identical decoded rows — regrouped
// along the time axis into chunks of ONE timestep by
// scripts/playback-rig/rechunk_playback_store.py, the same deploy-repo tool
// that produced the W0 rig's prod-scale 741_410_1328_chunk1 store.
//
// WHY IT EXISTS. A client that assumes a time-chunk length of 10 does not
// fail against this store — it computes chunkIndex = floor(t/10) and
// rowInChunk = t % 10, fetches a chunk that exists, and renders a real flood
// surface for the WRONG timestep. Reading timestep 10 here, an assuming
// client lands in `depth/c/1/0`, which holds timestep 1. That is the
// known-positive TASK-2724 AC4 demands, and it is why FIXTURE_PHYSICAL from
// the sibling fixture is the correct expected-value table for BOTH stores.

import { FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixturePlaybackStore';

// Re-exported so a test can assert against the same physical values through
// either store without importing two fixtures.
export { FIXTURE_PHYSICAL, FIXTURE_MESH };

export const FIXTURE_STORE_FILES_CHUNK1 = {
    "depth/c/0/0": "H4sIAAAAAAAAA2NgQAAAb8bVewwAAAA=",
    "depth/c/1/0": "H4sIAAAAAAAAA5Nht+TrYw4VXc3FwAAA4BY/EwwAAAA=",
    "depth/c/10/0": "H4sIAAAAAAAAA5Nxt+jrUw69uiqLgQEAfBkjmgwAAAA=",
    "depth/c/11/0": "H4sIAAAAAAAAA7P0K5wjo77qVWgpAwMANDxFFgwAAAA=",
    "depth/c/12/0": "H4sIAAAAAAAAAwsNXbVqtdb//wwNDAwAt+JrSgwAAAA=",
    "depth/c/2/0": "H4sIAAAAAAAAA7PkK5KRYV+tFSrKwAAAVVdM6AwAAAA=",
    "depth/c/3/0": "H4sIAAAAAAAAAwsVXa21movBgUGBgQEA3MAidQwAAAA=",
    "depth/c/4/0": "H4sIAAAAAAAAAyuSeWxhyRcaulqLgQEAduzJlwwAAAA=",
    "depth/c/5/0": "H4sIAAAAAAAAA+tTlnE/LrgqK9SUgQEANMCAbgwAAAA=",
    "depth/c/6/0": "H4sIAAAAAAAAA1utFRoaKsrQwODAwAAAhjsmmAwAAAA=",
    "depth/c/7/0": "H4sIAAAAAAAAAztu2Jf8WCJ06iovBgYAh9c/aAwAAAA=",
    "depth/c/8/0": "H4sIAAAAAAAAA3tscbywSGbVqtBQBgYAQ7lz8QwAAAA=",
    "depth/c/9/0": "H4sIAAAAAAAAA2NwYGhgUPi/nyGBgQEAehnxOgwAAAA=",
    "depth/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEsCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLAogICJjb2RlY3MiOiBbCiAgICB7CiAgICAgICJuYW1lIjogImJ5dGVzIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImVuZGlhbiI6ICJsaXR0bGUiCiAgICAgIH0KICAgIH0sCiAgICB7CiAgICAgICJuYW1lIjogImd6aXAiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAibGV2ZWwiOiA2CiAgICAgIH0KICAgIH0KICBdLAogICJhdHRyaWJ1dGVzIjogewogICAgInNjYWxlIjogNS40OTMyNDc2NDYzMzg0ODFlLTA2LAogICAgIm9mZnNldCI6IDAuMCwKICAgICJxdWFudGl6ZWRfZHR5cGUiOiAidWludDE2IiwKICAgICJieXRlb3JkZXIiOiAibGl0dGxlIiwKICAgICJ2YWxpZF9taW4iOiAwLjAsCiAgICAidmFsaWRfbWF4IjogMC4zNTk5OTk5ODQ1MDI3OTIzNgogIH0sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImFycmF5IiwKICAic3RvcmFnZV90cmFuc2Zvcm1lcnMiOiBbXQp9",
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
    "x_velocity/c/0/0": "H4sIAAAAAAAAA/tf/x8OAZoIUJ8MAAAA",
    "x_velocity/c/1/0": "H4sIAAAAAAAAA9v1b+1/od+3/uf+/18PAPacPC4MAAAA",
    "x_velocity/c/10/0": "H4sIAAAAAAAAA/v9/+//j///Acn/9QD0ng0lDAAAAA==",
    "x_velocity/c/11/0": "H4sIAAAAAAAAA/vz/9//z0D89///egAFy4f4DAAAAA==",
    "x_velocity/c/12/0": "H4sIAAAAAAAAA/vz/9//r0D89///egCCwug+DAAAAA==",
    "x_velocity/c/2/0": "H4sIAAAAAAAAA1v7/9X/Xf++/r/1/389AMJJm7YMAAAA",
    "x_velocity/c/3/0": "H4sIAAAAAAAAA7v1/+v/3P+//r/7/78eAE5SXBQMAAAA",
    "x_velocity/c/4/0": "H4sIAAAAAAAAA3v1/+f/tf///P/6/389AHDwrjEMAAAA",
    "x_velocity/c/5/0": "H4sIAAAAAAAAA/v4//f/U////v/x/389AGXLyasMAAAA",
    "x_velocity/c/6/0": "H4sIAAAAAAAAA/v6/8//W////v/1/389AMMSoZwMAAAA",
    "x_velocity/c/7/0": "H4sIAAAAAAAAA/vx/+//J////f/9/389AJcso0MMAAAA",
    "x_velocity/c/8/0": "H4sIAAAAAAAAA/v5/+//V////f/z/389AHNKW1AMAAAA",
    "x_velocity/c/9/0": "H4sIAAAAAAAAA/v1/+//d////f/z/389AHmWj6MMAAAA",
    "x_velocity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEsCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAzMjc2NywKICAiY29kZWNzIjogWwogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHsKICAgICJzY2FsZSI6IDkuMTU1NDgzMTczMzc4ODZlLTA2LAogICAgIm9mZnNldCI6IC0wLjI5OTk5NzcxNzE0MjEwNTEsCiAgICAicXVhbnRpemVkX2R0eXBlIjogInVpbnQxNiIsCiAgICAiYnl0ZW9yZGVyIjogImxpdHRsZSIsCiAgICAidmFsaWRfbWluIjogLTAuMjk5OTk3NzE3MTQyMTA1MSwKICAgICJ2YWxpZF9tYXgiOiAwLjI5OTk5NzcxNzE0MjEwNTEKICB9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "y_velocity/c/0/0": "H4sIAAAAAAAAA/tf/x8OAZoIUJ8MAAAA",
    "y_velocity/c/1/0": "H4sIAAAAAAAAA2vSfqj1SfeQFrf2/3oAXy2Z6QwAAAA=",
    "y_velocity/c/10/0": "H4sIAAAAAAAAA1ujtVprs9YqIPm/HgDobxHYDAAAAA==",
    "y_velocity/c/11/0": "H4sIAAAAAAAAA1ujtVpro9YqIPm/HgCVaDSaDAAAAA==",
    "y_velocity/c/12/0": "H4sIAAAAAAAAA1ujtVprg9YqIPm/HgALaJ5WDAAAAA==",
    "y_velocity/c/2/0": "H4sIAAAAAAAAA3uotUOrSXuD1iGt//UAPiI3sQwAAAA=",
    "y_velocity/c/3/0": "H4sIAAAAAAAAAzuktUGLW3ut1lat//UAU3ybyAwAAAA=",
    "y_velocity/c/4/0": "H4sIAAAAAAAAA9uhtU7rodYarQ1a/+sBF7VkdwwAAAA=",
    "y_velocity/c/5/0": "H4sIAAAAAAAAA9ustUbrrNZqrXVa/+sBKaYZAQwAAAA=",
    "y_velocity/c/6/0": "H4sIAAAAAAAAA9ugtUbrkNZqrbVa/+sBm8kSvQwAAAA=",
    "y_velocity/c/7/0": "H4sIAAAAAAAAA1uvtVprDxCv0fpfDwCoRCQgDAAAAA==",
    "y_velocity/c/8/0": "H4sIAAAAAAAAA1untVprBxCv0fpfDwA9Bss/DAAAAA==",
    "y_velocity/c/9/0": "H4sIAAAAAAAAA1urtVprq9YqIPm/HgAAKtuFDAAAAA==",
    "y_velocity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEsCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAzMjc2NywKICAiY29kZWNzIjogWwogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHsKICAgICJzY2FsZSI6IDkuMTU1NDgzMTczMzc4ODZlLTA2LAogICAgIm9mZnNldCI6IC0wLjI5OTk5NzcxNzE0MjEwNTEsCiAgICAicXVhbnRpemVkX2R0eXBlIjogInVpbnQxNiIsCiAgICAiYnl0ZW9yZGVyIjogImxpdHRsZSIsCiAgICAidmFsaWRfbWluIjogLTAuMjk5OTk3NzE3MTQyMTA1MSwKICAgICJ2YWxpZF9tYXgiOiAwLjI5OTk5NzcxNzE0MjEwNTEKICB9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "zarr.json": "ewogICJhdHRyaWJ1dGVzIjogewogICAgImZvcm1hdF92ZXJzaW9uIjogMSwKICAgICJ4bGxjb3JuZXIiOiA1MDAwMDAuMCwKICAgICJ5bGxjb3JuZXIiOiA2OTAwMDAwLjAsCiAgICAiZmFsc2VfZWFzdGluZyI6IDUwMDAwMC4wLAogICAgImZhbHNlX25vcnRoaW5nIjogMTAwMDAwMDAuMCwKICAgICJlcHNnIjogMzI3NTYsCiAgICAiem9uZSI6IDU2LAogICAgInZlbG9jaXR5X2NvbnZlbnRpb24iOiAic29sdmVyX2Vwc2lsb24iLAogICAgInZlbG9jaXR5X2Zvcm11bGEiOiAidSA9IHVoIC8gKGggKyBoMC9oKSIsCiAgICAidmVsb2NpdHlfcHJvdGVjdGlvbiI6IDFlLTA2LAogICAgIm1pbmltdW1fYWxsb3dlZF9oZWlnaHQiOiAxZS0wNSwKICAgICJkaXNwbGF5X21hc2tfaCI6IDFlLTA1LAogICAgIm1pbmltdW1fc3RvcmFibGVfaGVpZ2h0IjogMC4wMDUsCiAgICAiZyI6IDkuOCwKICAgICJyaG9fdyI6IDEwMjMuMCwKICAgICJidWlsZGluZ19tYW5uaW5nc19uIjogMTAuMCwKICAgICJmbG93X2FsZ29yaXRobSI6ICJERTAiLAogICAgIm1vZGVsX3N0YXJ0IjogIjE5NzAtMDEtMDFUMDA6MDA6MDArMDA6MDAiLAogICAgInRpbWVfdW5pdHMiOiAic2Vjb25kcyIsCiAgICAiaGFzX2R0IjogZmFsc2UsCiAgICAiZHRfc291cmNlIjogbnVsbCwKICAgICJzbW9vdGhpbmciOiAidmVydGV4LWF2ZXJhZ2VkIiwKICAgICJhbnVnYV92ZXJzaW9uIjogIjMuMy43LWZpeHR1cmUiLAogICAgInJldmlzaW9uX251bWJlciI6ICJmaXh0dXJlIiwKICAgICJyZXZpc2lvbl9kYXRlIjogImZpeHR1cmUiLAogICAgImNvZGVjIjogImd6aXAiLAogICAgImNvZGVjX2xldmVsIjogNgogIH0sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImdyb3VwIgp9"
};

export const FIXTURE_MANIFEST_CHUNK1 = {
    "bucket": "fixture-bucket",
    "prefix": "playback/fixture_project_fixture_scenario_fixture_run_chunk1/",
    "chunk_urls": {
        "depth/c/0/0": "depth/c/0/0",
        "depth/c/1/0": "depth/c/1/0",
        "depth/c/10/0": "depth/c/10/0",
        "depth/c/11/0": "depth/c/11/0",
        "depth/c/12/0": "depth/c/12/0",
        "depth/c/2/0": "depth/c/2/0",
        "depth/c/3/0": "depth/c/3/0",
        "depth/c/4/0": "depth/c/4/0",
        "depth/c/5/0": "depth/c/5/0",
        "depth/c/6/0": "depth/c/6/0",
        "depth/c/7/0": "depth/c/7/0",
        "depth/c/8/0": "depth/c/8/0",
        "depth/c/9/0": "depth/c/9/0",
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
        "x_velocity/c/10/0": "x_velocity/c/10/0",
        "x_velocity/c/11/0": "x_velocity/c/11/0",
        "x_velocity/c/12/0": "x_velocity/c/12/0",
        "x_velocity/c/2/0": "x_velocity/c/2/0",
        "x_velocity/c/3/0": "x_velocity/c/3/0",
        "x_velocity/c/4/0": "x_velocity/c/4/0",
        "x_velocity/c/5/0": "x_velocity/c/5/0",
        "x_velocity/c/6/0": "x_velocity/c/6/0",
        "x_velocity/c/7/0": "x_velocity/c/7/0",
        "x_velocity/c/8/0": "x_velocity/c/8/0",
        "x_velocity/c/9/0": "x_velocity/c/9/0",
        "x_velocity/zarr.json": "x_velocity/zarr.json",
        "y_velocity/c/0/0": "y_velocity/c/0/0",
        "y_velocity/c/1/0": "y_velocity/c/1/0",
        "y_velocity/c/10/0": "y_velocity/c/10/0",
        "y_velocity/c/11/0": "y_velocity/c/11/0",
        "y_velocity/c/12/0": "y_velocity/c/12/0",
        "y_velocity/c/2/0": "y_velocity/c/2/0",
        "y_velocity/c/3/0": "y_velocity/c/3/0",
        "y_velocity/c/4/0": "y_velocity/c/4/0",
        "y_velocity/c/5/0": "y_velocity/c/5/0",
        "y_velocity/c/6/0": "y_velocity/c/6/0",
        "y_velocity/c/7/0": "y_velocity/c/7/0",
        "y_velocity/c/8/0": "y_velocity/c/8/0",
        "y_velocity/c/9/0": "y_velocity/c/9/0",
        "y_velocity/zarr.json": "y_velocity/zarr.json",
        "zarr.json": "zarr.json"
    },
    "schema_metadata": {
        "format_version": 1,
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
            1,
            6
        ],
        "x_velocity": [
            1,
            6
        ],
        "y_velocity": [
            1,
            6
        ]
    },
    "expires_at": "2026-08-06T23:59:59+00:00"
};
