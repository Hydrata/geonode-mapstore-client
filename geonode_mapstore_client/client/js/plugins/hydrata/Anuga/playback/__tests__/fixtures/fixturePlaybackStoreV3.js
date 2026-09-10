// AUTO-GENERATED (TASK-2991, W3.3, epic 2981) — DO NOT HAND-EDIT.
//
// Regenerate with:
//   python3 playback-rig/make_v3_js_fixture.py           (in the deploy repo)
//   python3 playback-rig/make_v3_js_fixture.py --check   (drift gate)
//
// The SAME store as fixturePlaybackStore.js — same mesh, same physical
// values, same quantization attrs — with depth / x_velocity / y_velocity
// re-encoded through the REAL run_anuga.playback_codecs.TemporalDeltaCodec
// (zarr 3.3 ArrayArrayCodec), so their on-disk bytes are wrapped first
// differences along the time axis and their declared chain is
// [temporal_delta, bytes, gzip]. Every other array is untouched.
//
// WHY IT EXISTS. A client that does not invert the delta DOES NOT FAIL: it
// gunzips successfully, gets a buffer of exactly the right length, and
// renders a field of running differences as depth. There is no exception and
// no 404 — the same silent-wrong-water shape TASK-2724's chunk length had.
// Because the values round-trip, FIXTURE_PHYSICAL is the correct
// expected-value table for this store too, and "v3 decodes like v2" is an
// exact equality rather than an approximation.

import { FIXTURE_PHYSICAL, FIXTURE_MESH } from './fixturePlaybackStore';

export { FIXTURE_PHYSICAL, FIXTURE_MESH };

export const FIXTURE_STORE_FILES_V3 = {
    "depth/c/0/0": "H4sIAAAAAAAA/2NgQAAZdku+PuZQ0dVcDAyyYHaY6CouiHg/XNwCrgamfhWSenRxVL0I8wF5Eb6JeAAAAA==",
    "depth/c/1/0": "H4sIAAAAAAAA/5Nxt+jrUw69uiqLgUGW3ZKvjzlUdDUXA4MMkN0PZa9eFRYaepWRgaGBgWoAAJOUvlZ4AAAA",
    "depth/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEwLAogICAgICAgIDYKICAgICAgXQogICAgfQogIH0sCiAgImNodW5rX2tleV9lbmNvZGluZyI6IHsKICAgICJuYW1lIjogImRlZmF1bHQiLAogICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICJzZXBhcmF0b3IiOiAiLyIKICAgIH0KICB9LAogICJmaWxsX3ZhbHVlIjogMCwKICAiY29kZWNzIjogWwogICAgewogICAgICAibmFtZSI6ICJ0ZW1wb3JhbF9kZWx0YSIKICAgIH0sCiAgICB7CiAgICAgICJuYW1lIjogImJ5dGVzIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImVuZGlhbiI6ICJsaXR0bGUiCiAgICAgIH0KICAgIH0sCiAgICB7CiAgICAgICJuYW1lIjogImd6aXAiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAibGV2ZWwiOiA2CiAgICAgIH0KICAgIH0KICBdLAogICJhdHRyaWJ1dGVzIjogewogICAgInNjYWxlIjogNS40OTMyNDc2NDYzMzg0ODFlLTA2LAogICAgIm9mZnNldCI6IDAuMCwKICAgICJxdWFudGl6ZWRfZHR5cGUiOiAidWludDE2IiwKICAgICJieXRlb3JkZXIiOiAibGl0dGxlIiwKICAgICJ2YWxpZF9taW4iOiAwLjAsCiAgICAidmFsaWRfbWF4IjogMC4zNTk5OTk5ODQ1MDI3OTIzNgogIH0sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImFycmF5IiwKICAic3RvcmFnZV90cmFuc2Zvcm1lcnMiOiBbXQp9",
    "dt_ms/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzCiAgXSwKICAiZGF0YV90eXBlIjogImZsb2F0MzIiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEzCiAgICAgIF0KICAgIH0KICB9LAogICJjaHVua19rZXlfZW5jb2RpbmciOiB7CiAgICAibmFtZSI6ICJkZWZhdWx0IiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAic2VwYXJhdG9yIjogIi8iCiAgICB9CiAgfSwKICAiZmlsbF92YWx1ZSI6ICJOYU4iLAogICJjb2RlY3MiOiBbCiAgICB7CiAgICAgICJuYW1lIjogImJ5dGVzIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImVuZGlhbiI6ICJsaXR0bGUiCiAgICAgIH0KICAgIH0sCiAgICB7CiAgICAgICJuYW1lIjogImd6aXAiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAibGV2ZWwiOiA2CiAgICAgIH0KICAgIH0KICBdLAogICJhdHRyaWJ1dGVzIjoge30sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImFycmF5IiwKICAic3RvcmFnZV90cmFuc2Zvcm1lcnMiOiBbXQp9",
    "elevation/c/0": "H4sIAAAAAAAA/2NgYGA4e+aM7dkzPnZAbDtrpqQdA0ODHQCA//NJGAAAAA==",
    "elevation/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "face_node_connectivity/c/0/0": "H4sIAAAAAAAA/2NgYGBgBGJmKM2CxGaC8kE0K5QNAGeqW6AwAAAA",
    "face_node_connectivity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDQsCiAgICAzCiAgXSwKICAiZGF0YV90eXBlIjogImludDMyIiwKICAiY2h1bmtfZ3JpZCI6IHsKICAgICJuYW1lIjogInJlZ3VsYXIiLAogICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICJjaHVua19zaGFwZSI6IFsKICAgICAgICA0LAogICAgICAgIDMKICAgICAgXQogICAgfQogIH0sCiAgImNodW5rX2tleV9lbmNvZGluZyI6IHsKICAgICJuYW1lIjogImRlZmF1bHQiLAogICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICJzZXBhcmF0b3IiOiAiLyIKICAgIH0KICB9LAogICJmaWxsX3ZhbHVlIjogLTEsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "friction/c/0": "H4sIAAAAAAAA/+O6rmzLhQUDAOjpqJ4YAAAA",
    "friction/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "inradius/c/0": "H4sIAAAAAAAA/yu7KeZQAsTlQFwMxAB4eIXWEAAAAA==",
    "inradius/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDQKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNAogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "node_x/c/0": "H4sIAAAAAAAA/2NgAAEFRwaGBY4MSGwAk7qIxxgAAAA=",
    "node_x/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "node_y/c/0": "H4sIAAAAAAAA/2NgQAYKjjAMAN//FdMYAAAA",
    "node_y/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDYKICBdLAogICJkYXRhX3R5cGUiOiAiZmxvYXQzMiIsCiAgImNodW5rX2dyaWQiOiB7CiAgICAibmFtZSI6ICJyZWd1bGFyIiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAiY2h1bmtfc2hhcGUiOiBbCiAgICAgICAgNgogICAgICBdCiAgICB9CiAgfSwKICAiY2h1bmtfa2V5X2VuY29kaW5nIjogewogICAgIm5hbWUiOiAiZGVmYXVsdCIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgInNlcGFyYXRvciI6ICIvIgogICAgfQogIH0sCiAgImZpbGxfdmFsdWUiOiAwLjAsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAiYnl0ZXMiLAogICAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgICAiZW5kaWFuIjogImxpdHRsZSIKICAgICAgfQogICAgfSwKICAgIHsKICAgICAgIm5hbWUiOiAiZ3ppcCIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJsZXZlbCI6IDYKICAgICAgfQogICAgfQogIF0sCiAgImF0dHJpYnV0ZXMiOiB7fSwKICAiemFycl9mb3JtYXQiOiAzLAogICJub2RlX3R5cGUiOiAiYXJyYXkiLAogICJzdG9yYWdlX3RyYW5zZm9ybWVycyI6IFtdCn0=",
    "time/c/0": "H4sIAAAAAAAA/2NgQAZ2DhDaD0I3hEH5cRD6QBJUPA1CO2RB5fMg9IMCqLoiCL2gBKq+zAEAno/I/GgAAAA=",
    "time/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzCiAgXSwKICAiZGF0YV90eXBlIjogImZsb2F0NjQiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEzCiAgICAgIF0KICAgIH0KICB9LAogICJjaHVua19rZXlfZW5jb2RpbmciOiB7CiAgICAibmFtZSI6ICJkZWZhdWx0IiwKICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAic2VwYXJhdG9yIjogIi8iCiAgICB9CiAgfSwKICAiZmlsbF92YWx1ZSI6IDAuMCwKICAiY29kZWNzIjogWwogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHt9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "x_velocity/c/0/0": "H4sIAAAAAAAA//tf/x8Od9etqxeuvl2fV8/A8JnBlmEFszRDLgMDgy4DN8NmBlYGESBbgIGFwYGBiYEdyGYH0rIMjAzMQDYLkBYA0kxAzAxkcwExI5ANwmxQmhGsDgIAuHAcbXgAAAA=",
    "x_velocity/c/1/0": "H4sIAAAAAAAA//v9/+//j///Acn/9YwMjAxMDAgAYzM3MDZwATFTAwPVAADGxZlaeAAAAA==",
    "x_velocity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEwLAogICAgICAgIDYKICAgICAgXQogICAgfQogIH0sCiAgImNodW5rX2tleV9lbmNvZGluZyI6IHsKICAgICJuYW1lIjogImRlZmF1bHQiLAogICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICJzZXBhcmF0b3IiOiAiLyIKICAgIH0KICB9LAogICJmaWxsX3ZhbHVlIjogMzI3NjcsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAidGVtcG9yYWxfZGVsdGEiCiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHsKICAgICJzY2FsZSI6IDkuMTU1NDgzMTczMzc4ODZlLTA2LAogICAgIm9mZnNldCI6IC0wLjI5OTk5NzcxNzE0MjEwNTEsCiAgICAicXVhbnRpemVkX2R0eXBlIjogInVpbnQxNiIsCiAgICAiYnl0ZW9yZGVyIjogImxpdHRsZSIsCiAgICAidmFsaWRfbWluIjogLTAuMjk5OTk3NzE3MTQyMTA1MSwKICAgICJ2YWxpZF9tYXgiOiAwLjI5OTk5NzcxNzE0MjEwNTEKICB9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "y_velocity/c/0/0": "H4sIAAAAAAAA/z3KMQ5AQBRF0b8Ae7QUhUpnHTNRW4A9UFOLZkLEmLkehfdzk1N8Kv6r/eJCN7jCm5VMtGmjx2zmpCER5IPMCEQ5yquc5aR2xRdcv81u9Y7v753ZAxGkE7F4AAAA",
    "y_velocity/c/1/0": "H4sIAAAAAAAA/1ujtVprs9YqIPm/ngEI/v1ngIP/UHZwaEiof2gokGSgGgAApjPXPngAAAA=",
    "y_velocity/zarr.json": "ewogICJzaGFwZSI6IFsKICAgIDEzLAogICAgNgogIF0sCiAgImRhdGFfdHlwZSI6ICJ1aW50MTYiLAogICJjaHVua19ncmlkIjogewogICAgIm5hbWUiOiAicmVndWxhciIsCiAgICAiY29uZmlndXJhdGlvbiI6IHsKICAgICAgImNodW5rX3NoYXBlIjogWwogICAgICAgIDEwLAogICAgICAgIDYKICAgICAgXQogICAgfQogIH0sCiAgImNodW5rX2tleV9lbmNvZGluZyI6IHsKICAgICJuYW1lIjogImRlZmF1bHQiLAogICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICJzZXBhcmF0b3IiOiAiLyIKICAgIH0KICB9LAogICJmaWxsX3ZhbHVlIjogMzI3NjcsCiAgImNvZGVjcyI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAidGVtcG9yYWxfZGVsdGEiCiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJieXRlcyIsCiAgICAgICJjb25maWd1cmF0aW9uIjogewogICAgICAgICJlbmRpYW4iOiAibGl0dGxlIgogICAgICB9CiAgICB9LAogICAgewogICAgICAibmFtZSI6ICJnemlwIiwKICAgICAgImNvbmZpZ3VyYXRpb24iOiB7CiAgICAgICAgImxldmVsIjogNgogICAgICB9CiAgICB9CiAgXSwKICAiYXR0cmlidXRlcyI6IHsKICAgICJzY2FsZSI6IDkuMTU1NDgzMTczMzc4ODZlLTA2LAogICAgIm9mZnNldCI6IC0wLjI5OTk5NzcxNzE0MjEwNTEsCiAgICAicXVhbnRpemVkX2R0eXBlIjogInVpbnQxNiIsCiAgICAiYnl0ZW9yZGVyIjogImxpdHRsZSIsCiAgICAidmFsaWRfbWluIjogLTAuMjk5OTk3NzE3MTQyMTA1MSwKICAgICJ2YWxpZF9tYXgiOiAwLjI5OTk5NzcxNzE0MjEwNTEKICB9LAogICJ6YXJyX2Zvcm1hdCI6IDMsCiAgIm5vZGVfdHlwZSI6ICJhcnJheSIsCiAgInN0b3JhZ2VfdHJhbnNmb3JtZXJzIjogW10KfQ==",
    "zarr.json": "ewogICJhdHRyaWJ1dGVzIjogewogICAgImZvcm1hdF92ZXJzaW9uIjogMywKICAgICJ4bGxjb3JuZXIiOiA1MDAwMDAuMCwKICAgICJ5bGxjb3JuZXIiOiA2OTAwMDAwLjAsCiAgICAiZmFsc2VfZWFzdGluZyI6IDUwMDAwMC4wLAogICAgImZhbHNlX25vcnRoaW5nIjogMTAwMDAwMDAuMCwKICAgICJlcHNnIjogMzI3NTYsCiAgICAiem9uZSI6IDU2LAogICAgInZlbG9jaXR5X2NvbnZlbnRpb24iOiAic29sdmVyX2Vwc2lsb24iLAogICAgInZlbG9jaXR5X2Zvcm11bGEiOiAidSA9IHVoIC8gKGggKyBoMC9oKSIsCiAgICAidmVsb2NpdHlfcHJvdGVjdGlvbiI6IDFlLTA2LAogICAgIm1pbmltdW1fYWxsb3dlZF9oZWlnaHQiOiAxZS0wNSwKICAgICJkaXNwbGF5X21hc2tfaCI6IDFlLTA1LAogICAgIm1pbmltdW1fc3RvcmFibGVfaGVpZ2h0IjogMC4wMDUsCiAgICAiZyI6IDkuOCwKICAgICJyaG9fdyI6IDEwMjMuMCwKICAgICJidWlsZGluZ19tYW5uaW5nc19uIjogMTAuMCwKICAgICJmbG93X2FsZ29yaXRobSI6ICJERTAiLAogICAgIm1vZGVsX3N0YXJ0IjogIjE5NzAtMDEtMDFUMDA6MDA6MDArMDA6MDAiLAogICAgInRpbWVfdW5pdHMiOiAic2Vjb25kcyIsCiAgICAiaGFzX2R0IjogZmFsc2UsCiAgICAiZHRfc291cmNlIjogbnVsbCwKICAgICJzbW9vdGhpbmciOiAidmVydGV4LWF2ZXJhZ2VkIiwKICAgICJhbnVnYV92ZXJzaW9uIjogIjMuMy43LWZpeHR1cmUiLAogICAgInJldmlzaW9uX251bWJlciI6ICJmaXh0dXJlIiwKICAgICJyZXZpc2lvbl9kYXRlIjogImZpeHR1cmUiLAogICAgImNvZGVjIjogImd6aXAiLAogICAgImNvZGVjX2xldmVsIjogNiwKICAgICJ0ZW1wb3JhbF9kZWx0YV9hcHBsaWVkIjogdHJ1ZQogIH0sCiAgInphcnJfZm9ybWF0IjogMywKICAibm9kZV90eXBlIjogImdyb3VwIgp9"
};

export const FIXTURE_MANIFEST_V3 = {
    "bucket": "fixture-bucket",
    "prefix": "playback/fixture_project_fixture_scenario_fixture_run_v3/",
    "chunk_urls": {
        "depth/c/0/0": "depth/c/0/0",
        "depth/c/1/0": "depth/c/1/0",
        "depth/zarr.json": "depth/zarr.json",
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
        "x_velocity/zarr.json": "x_velocity/zarr.json",
        "y_velocity/c/0/0": "y_velocity/c/0/0",
        "y_velocity/c/1/0": "y_velocity/c/1/0",
        "y_velocity/zarr.json": "y_velocity/zarr.json",
        "zarr.json": "zarr.json"
    },
    "schema_metadata": {
        "format_version": 3,
        "n_node": 6,
        "n_time": 13,
        "chunk_length_t": 10,
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
        "codec_level": 6,
        "temporal_delta_applied": true
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
            10,
            6
        ],
        "x_velocity": [
            10,
            6
        ],
        "y_velocity": [
            10,
            6
        ]
    },
    "codecs": {
        "depth": [
            {
                "name": "temporal_delta"
            },
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "dt_ms": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "elevation": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "face_node_connectivity": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "friction": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "inradius": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "node_x": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "node_y": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "time": [
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "x_velocity": [
            {
                "name": "temporal_delta"
            },
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ],
        "y_velocity": [
            {
                "name": "temporal_delta"
            },
            {
                "name": "bytes",
                "configuration": {
                    "endian": "little"
                }
            },
            {
                "name": "gzip",
                "configuration": {
                    "level": 6
                }
            }
        ]
    },
    "expires_at": "2026-08-06T23:59:59+00:00"
};
