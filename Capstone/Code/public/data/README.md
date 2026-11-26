# Chennai illustrative planning dataset

24 demand areas and 12 hypothetical collection sites in central Chennai, India.
Created for this application; released under CC0. This is a reproducible synthetic
benchmark, not a municipal inventory or verified collection-center directory.
Locality names are real; WGS84 coordinates are approximate representative points.
No claim is made about the presence of an actual facility at these coordinates.

Demand fields: `id` (unique string), `name`, `lat`, `lon`, `kg` (illustrative
kilograms of e-waste available in one monthly collection cycle).
Site fields: `id`, `name`, `lat`, `lon`, `radius` (straight-line service reach in
km), `cost` (illustrative INR per monthly collection cycle).
Costs include no documented vendor quotations. Quantities are not survey estimates.

Coverage is derived using the haversine distance with Earth radius 6371 km.
A demand area is covered when distance <= site radius × the UI reach multiplier.
Export coverage.csv from the application to obtain all computed relationships.
The model does not account for road access, traffic, capacity, routing, or facility
licensing. Covered kg represents potential accessible demand, not collected waste
or verified carbon savings. Replace these CSVs with validated local data for use.
