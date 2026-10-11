
import { supabase } from "@/lib/supabase";

export default async function DatabaseTestPage() {
  const { data: venues, error } = await supabase
    .from("venues")
    .select("id, name, sport, location, price_per_hour")
    .order("name");

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Could not fetch venues</h1>
        <pre>{error.message}</pre>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Motion venues from Supabase</h1>

      {venues.length === 0 ? (
        <p>No venues found. Add a venue in Supabase first.</p>
      ) : (
        <ul>
          {venues.map((venue) => (
            <li key={venue.id}>
              <strong>{venue.name}</strong>
              {" — "}
              {venue.sport}
              {" — "}
              {venue.location}
              {" — ฿"}
              {venue.price_per_hour}/hour
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
