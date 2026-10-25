
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "badge_parameters": {
                  Row: {
                    "badge_id": Database["public"]['Enums']["badge_id"],"label": string,"threshold": number
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_id": Database["public"]['Enums']["badge_id"],"label": string,"threshold": number
                  }
                  Update: {
                    "badge_id"?: Database["public"]['Enums']["badge_id"],"label"?: string,"threshold"?: number
                  }
                  Relationships: [
                    
                  ]
                },"match_requests": {
                  Row: {
                    "direction": Database["public"]['Enums']["leg_direction"],"id": string,"notes_shortened": boolean,"request_note": string | null,"requester_id": string,"requester_trip_id": string,"resolution_note": string | null,"resolved_by": Database["public"]['Enums']["resolved_by"] | null,"status": Database["public"]['Enums']["match_request_status"],"trip_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "direction": Database["public"]['Enums']["leg_direction"],"id"?: string,"notes_shortened"?: boolean,"request_note"?: string | null,"requester_id": string,"requester_trip_id": string,"resolution_note"?: string | null,"resolved_by"?: Database["public"]['Enums']["resolved_by"] | null,"status": Database["public"]['Enums']["match_request_status"],"trip_id": string
                  }
                  Update: {
                    "direction"?: Database["public"]['Enums']["leg_direction"],"id"?: string,"notes_shortened"?: boolean,"request_note"?: string | null,"requester_id"?: string,"requester_trip_id"?: string,"resolution_note"?: string | null,"resolved_by"?: Database["public"]['Enums']["resolved_by"] | null,"status"?: Database["public"]['Enums']["match_request_status"],"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_requests_leg_fkey"
      columns: ["trip_id","direction"]
isOneToOne: false
      referencedRelation: "trip_legs"
      referencedColumns: ["trip_id","direction"]
    },{
      foreignKeyName: "match_requests_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_requests_requester_trip_fkey"
      columns: ["requester_trip_id","requester_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"parameters": {
                  Row: {
                    "key": Database["public"]['Enums']["parameter_key"],"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": Database["public"]['Enums']["parameter_key"],"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: Database["public"]['Enums']["parameter_key"],"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"personal_bests": {
                  Row: {
                    "profile_id": string,"shared_km": number,"shared_legs": number,"shared_trips": number,"transported_colleagues": number
                  }
                  ComputedFields: never
                  Insert: {
                    "profile_id": string,"shared_km"?: number,"shared_legs"?: number,"shared_trips"?: number,"transported_colleagues"?: number
                  }
                  Update: {
                    "profile_id"?: string,"shared_km"?: number,"shared_legs"?: number,"shared_trips"?: number,"transported_colleagues"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "personal_bests_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"plant_distances": {
                  Row: {
                    "from_plant_id": Database["public"]['Enums']["plant_id"],"km": number,"to_plant_id": Database["public"]['Enums']["plant_id"]
                  }
                  ComputedFields: never
                  Insert: {
                    "from_plant_id": Database["public"]['Enums']["plant_id"],"km": number,"to_plant_id": Database["public"]['Enums']["plant_id"]
                  }
                  Update: {
                    "from_plant_id"?: Database["public"]['Enums']["plant_id"],"km"?: number,"to_plant_id"?: Database["public"]['Enums']["plant_id"]
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "display_name": string,"id": string,"plant_id": Database["public"]['Enums']["plant_id"]
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"id": string,"plant_id": Database["public"]['Enums']["plant_id"]
                  }
                  Update: {
                    "display_name"?: string,"id"?: string,"plant_id"?: Database["public"]['Enums']["plant_id"]
                  }
                  Relationships: [
                    
                  ]
                },"trip_legs": {
                  Row: {
                    "direction": Database["public"]['Enums']["leg_direction"],"seats_available": number,"seats_total": number,"trip_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "direction": Database["public"]['Enums']["leg_direction"],"seats_available": number,"seats_total": number,"trip_id": string
                  }
                  Update: {
                    "direction"?: Database["public"]['Enums']["leg_direction"],"seats_available"?: number,"seats_total"?: number,"trip_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_legs_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "departure_at": string,"from_plant_id": Database["public"]['Enums']["plant_id"],"has_car": boolean,"id": string,"owner_id": string,"return_at": string | null,"seats_available": number,"seats_total": number,"status": Database["public"]['Enums']["trip_status"],"to_plant_id": Database["public"]['Enums']["plant_id"]
                  }
                  ComputedFields: never
                  Insert: {
                    "departure_at": string,"from_plant_id": Database["public"]['Enums']["plant_id"],"has_car": boolean,"id"?: string,"owner_id": string,"return_at"?: string | null,"seats_available": number,"seats_total": number,"status": Database["public"]['Enums']["trip_status"],"to_plant_id": Database["public"]['Enums']["plant_id"]
                  }
                  Update: {
                    "departure_at"?: string,"from_plant_id"?: Database["public"]['Enums']["plant_id"],"has_car"?: boolean,"id"?: string,"owner_id"?: string,"return_at"?: string | null,"seats_available"?: number,"seats_total"?: number,"status"?: Database["public"]['Enums']["trip_status"],"to_plant_id"?: Database["public"]['Enums']["plant_id"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "trips_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "adjust_leg_seats":
{ Args: { "delta": number,"direction": Database["public"]['Enums']["leg_direction"],"trip_id": string }; Returns: {
              "direction": Database["public"]['Enums']["leg_direction"],
"seats_available": number,
"seats_total": number,
"trip_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "trip_legs"
        isOneToOne: false
        isSetofReturn: true
      } },
"raise_personal_bests":
{ Args: { "profile_id": string,"shared_km": number,"shared_legs": number,"shared_trips": number,"transported_colleagues": number }; Returns: {
              "profile_id": string,
"shared_km": number,
"shared_legs": number,
"shared_trips": number,
"transported_colleagues": number
            }[]
                          SetofOptions: {
        from: "*"
        to: "personal_bests"
        isOneToOne: false
        isSetofReturn: true
      } },
"restore_system_rejected":
{ Args: { "direction": Database["public"]['Enums']["leg_direction"],"trip_id": string }; Returns: string[]
                           }
          }
          Enums: {
            "badge_id": "primo-viaggio"|"cinque-viaggi"|"dieci-viaggi"|"primo-passaggio"|"cinque-colleghi"|"mille-km","leg_direction": "outbound"|"return","match_request_status": "pending"|"accepted"|"rejected"|"cancelled","parameter_key": "match.toleranceMinutes"|"createTrip.maxSeatsOffered"|"kpi.gramsCo2PerKm"|"kpi.rentalCostPerDay"|"kpi.fuelConsumptionLitersPer100Km"|"kpi.fuelPricePerLiter"|"notes.maxLength"|"cascade.autoRejectNote","plant_id": "pomigliano"|"foggia"|"grottaglie","resolved_by": "owner"|"requester"|"system","trip_status": "published"|"cancelled"|"completed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "badge_id": ["primo-viaggio", "cinque-viaggi", "dieci-viaggi", "primo-passaggio", "cinque-colleghi", "mille-km"],"leg_direction": ["outbound", "return"],"match_request_status": ["pending", "accepted", "rejected", "cancelled"],"parameter_key": ["match.toleranceMinutes", "createTrip.maxSeatsOffered", "kpi.gramsCo2PerKm", "kpi.rentalCostPerDay", "kpi.fuelConsumptionLitersPer100Km", "kpi.fuelPricePerLiter", "notes.maxLength", "cascade.autoRejectNote"],"plant_id": ["pomigliano", "foggia", "grottaglie"],"resolved_by": ["owner", "requester", "system"],"trip_status": ["published", "cancelled", "completed"]
          }
        }
} as const
