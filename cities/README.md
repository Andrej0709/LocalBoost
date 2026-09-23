# City suggestions

One file per country (ISO 3166-1 alpha-2 code), each a JSON array of place
names with 5,000+ inhabitants, largest first. The signup page loads the file
for the country the customer picks and offers the names as suggestions for the
CITY field; anything else they type is still accepted.

Built from the GeoNames `cities5000` export (https://www.geonames.org),
licensed under CC BY 4.0. "Beograd" is added to RS.json because GeoNames lists
the capital under its English name only.
