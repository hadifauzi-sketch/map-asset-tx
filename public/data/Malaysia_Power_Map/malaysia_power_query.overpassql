[out:json][timeout:180];area["ISO3166-1"="MY"]["admin_level"="2"]->.a;nwr["power"~"^(substation|transformer|line|minor_line|cable)$"](area.a);out geom;
