import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const rawData = [
  {
    "S No": "",
    "Company Name": "",
    "Stall \nModel": "",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "1",
    "Company Name": "V  Guard",
    "Stall \nModel": "Main Sponsor",
    "stall size in Meter ": "8-8",
    "Contact Pers": "Vineeth",
    "Mob Number": "7592925121",
    "": ""
  },
  {
    "S No": "2",
    "Company Name": "Su-Kam",
    "Stall \nModel": "Co Sponsor",
    "stall size in Meter ": "14/4",
    "Contact Pers": "Ankit",
    "Mob Number": "6283071150",
    "": ""
  },
  {
    "S No": "3",
    "Company Name": "TATA Solar",
    "Stall \nModel": "Co Sponsor",
    "stall size in Meter ": "14/4",
    "Contact Pers": "Sandeep",
    "Mob Number": "9495115525",
    "": ""
  },
  {
    "S No": "4",
    "Company Name": "Microtech International",
    "Stall \nModel": "Platinum - 1",
    "stall size in Meter ": "12-4",
    "Contact Pers": "Monsy",
    "Mob Number": "9947816999",
    "": ""
  },
  {
    "S No": "5",
    "Company Name": "Eastman",
    "Stall \nModel": "Platinum - 2",
    "stall size in Meter ": "12-4",
    "Contact Pers": "Nidheesh",
    "Mob Number": "8089281528",
    "": ""
  },
  {
    "S No": "6",
    "Company Name": "Rensolve",
    "Stall \nModel": "Platinum - 3",
    "stall size in Meter ": "12-4",
    "Contact Pers": "Abu Thahir",
    "Mob Number": "9745496113",
    "": ""
  },
  {
    "S No": "7",
    "Company Name": "BASE",
    "Stall \nModel": "Platinum - 4",
    "stall size in Meter ": "12-4",
    "Contact Pers": "Subhanshu",
    "Mob Number": "9955697183",
    "": ""
  },
  {
    "S No": "8",
    "Company Name": "KEFA Solar Energy",
    "Stall \nModel": "Platinum - 5",
    "stall size in Meter ": "12-4",
    "Contact Pers": "Anil",
    "Mob Number": "9048763455",
    "": ""
  },
  {
    "S No": "9",
    "Company Name": "EMMVEE",
    "Stall \nModel": "Platinum - 6",
    "stall size in Meter ": "12-4",
    "Contact Pers": "Shinoy",
    "Mob Number": "9447590208",
    "": ""
  },
  {
    "S No": "10",
    "Company Name": "Fox ESS (Semicon)",
    "Stall \nModel": "GOLD - 1",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Deva Prasath",
    "Mob Number": "9840741814",
    "": ""
  },
  {
    "S No": "11",
    "Company Name": "Roze Solar",
    "Stall \nModel": "GOLD - 2",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Shinoy",
    "Mob Number": "9447590208",
    "": ""
  },
  {
    "S No": "12",
    "Company Name": "Break Through",
    "Stall \nModel": "GOLD - 3",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Akhil",
    "Mob Number": "9496215223",
    "": ""
  },
  {
    "S No": "13",
    "Company Name": "Hykon",
    "Stall \nModel": "GOLD - 4",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Sujin",
    "Mob Number": "8714629144",
    "": ""
  },
  {
    "S No": "14",
    "Company Name": "VOLTRA Technologies",
    "Stall \nModel": "GOLD - 5",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Midhun",
    "Mob Number": "7496964535",
    "": ""
  },
  {
    "S No": "15",
    "Company Name": "Axis Power",
    "Stall \nModel": "GOLD - 6",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Amal",
    "Mob Number": "9645800069",
    "": ""
  },
  {
    "S No": "16",
    "Company Name": "Virjin Power",
    "Stall \nModel": "GOLD - 7",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Saji",
    "Mob Number": "7356606656",
    "": ""
  },
  {
    "S No": "17",
    "Company Name": "Feston (Allsun)",
    "Stall \nModel": "GOLD - 8",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Sunil",
    "Mob Number": "9349140014",
    "": ""
  },
  {
    "S No": "18",
    "Company Name": "Viridis Engineering",
    "Stall \nModel": "GOLD - 9",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Adarsh",
    "Mob Number": "8220162472",
    "": ""
  },
  {
    "S No": "19",
    "Company Name": "Risto",
    "Stall \nModel": "GOLD - 10",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Baiju",
    "Mob Number": "9567429999",
    "": ""
  },
  {
    "S No": "20",
    "Company Name": "Involtics",
    "Stall \nModel": "GOLD - 11",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Shubam Priya",
    "Mob Number": "9599524041",
    "": ""
  },
  {
    "S No": "21",
    "Company Name": "Prime Energy",
    "Stall \nModel": "GOLD - 12",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Lijo",
    "Mob Number": "9446393399",
    "": ""
  },
  {
    "S No": "22",
    "Company Name": "Torque Lithium Energy",
    "Stall \nModel": "GOLD - 13",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Manikandan",
    "Mob Number": "7305050862",
    "": ""
  },
  {
    "S No": "23",
    "Company Name": "Live Fast",
    "Stall \nModel": "GOLD - 14",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Sachin",
    "Mob Number": "9873711515",
    "": ""
  },
  {
    "S No": "24",
    "Company Name": "Crompton",
    "Stall \nModel": "GOLD - 15",
    "stall size in Meter ": "8-4",
    "Contact Pers": "Shammi Sharma",
    "Mob Number": "9810224410",
    "": ""
  },
  {
    "S No": "25",
    "Company Name": "Excel",
    "Stall \nModel": "Silver - 1",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Geo",
    "Mob Number": "9497804983",
    "": ""
  },
  {
    "S No": "26",
    "Company Name": "Wega",
    "Stall \nModel": "Silver - 2",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Muneer",
    "Mob Number": "7012244144",
    "": ""
  },
  {
    "S No": "31",
    "Company Name": "Energy Fox",
    "Stall \nModel": "Silver - 3",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Akash",
    "Mob Number": "8606885072",
    "": ""
  },
  {
    "S No": "32",
    "Company Name": "New Innovations",
    "Stall \nModel": "Silver - 4",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Sen",
    "Mob Number": "7907935702",
    "": ""
  },
  {
    "S No": "33",
    "Company Name": "Al Miya",
    "Stall \nModel": "Silver - 5",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Al Nishaan",
    "Mob Number": "7559833373",
    "": ""
  },
  {
    "S No": "34",
    "Company Name": "GIG Automation",
    "Stall \nModel": "Silver - 6",
    "stall size in Meter ": "4-4",
    "Contact Pers": "GIG",
    "Mob Number": "9946703117",
    "": ""
  },
  {
    "S No": "35",
    "Company Name": "Al Miya",
    "Stall \nModel": "Silver - 7",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Al Shaan",
    "Mob Number": "7559833373",
    "": ""
  },
  {
    "S No": "36",
    "Company Name": "Savitr Solar",
    "Stall \nModel": "Silver - 8",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Rajesh",
    "Mob Number": "9995504465",
    "": ""
  },
  {
    "S No": "37",
    "Company Name": "Meekar",
    "Stall \nModel": "Silver - 9",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Meekar",
    "Mob Number": "9072671137",
    "": ""
  },
  {
    "S No": "38",
    "Company Name": "Solar Storie",
    "Stall \nModel": "Silver - 10",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Belwin",
    "Mob Number": "7025359201",
    "": ""
  },
  {
    "S No": "39",
    "Company Name": "Energy Lab",
    "Stall \nModel": "Silver - 11",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Ayub",
    "Mob Number": "9746151111",
    "": ""
  },
  {
    "S No": "40",
    "Company Name": "Solar Storie",
    "Stall \nModel": "Silver - 12",
    "stall size in Meter ": "4-4",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "41",
    "Company Name": "Redon bty",
    "Stall \nModel": "Silver - 13",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Nathuram Sumithe",
    "Mob Number": "8660204239",
    "": ""
  },
  {
    "S No": "42",
    "Company Name": "Ever Energy",
    "Stall \nModel": "Silver - 14",
    "stall size in Meter ": "4-4",
    "Contact Pers": "",
    "Mob Number": "7736246146",
    "": "Renny"
  },
  {
    "S No": "43",
    "Company Name": "SUNFOCUS",
    "Stall \nModel": "Silver - 15",
    "stall size in Meter ": "4-4",
    "Contact Pers": "Jayaraj",
    "Mob Number": "9846823777",
    "": ""
  },
  {
    "S No": "44",
    "Company Name": "Ever Energy",
    "Stall \nModel": "Silver - 16",
    "stall size in Meter ": "4-4",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "45",
    "Company Name": "Battery Palace",
    "Stall \nModel": "Bronze - 1",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Chandrabanu",
    "Mob Number": "9447132075",
    "": ""
  },
  {
    "S No": "46",
    "Company Name": "Ananthapuri",
    "Stall \nModel": "Bronze - 2",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Sreekanth",
    "Mob Number": "9904428600",
    "": ""
  },
  {
    "S No": "47",
    "Company Name": "One Touch",
    "Stall \nModel": "Bronze - 3",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Shiyas",
    "Mob Number": "9188341489",
    "": ""
  },
  {
    "S No": "48",
    "Company Name": "SS Fastner",
    "Stall \nModel": "Bronze - 4",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Gokul",
    "Mob Number": "9400603997",
    "": "Baiju"
  },
  {
    "S No": "49",
    "Company Name": "net vishon",
    "Stall \nModel": "Bronze - 5",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "50",
    "Company Name": "Iron Grid",
    "Stall \nModel": "Bronze - 6",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Biju",
    "Mob Number": "9946759777",
    "": ""
  },
  {
    "S No": "51",
    "Company Name": "Cosmic Lights",
    "Stall \nModel": "Bronze - 7",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Anish",
    "Mob Number": "8921033427",
    "": ""
  },
  {
    "S No": "52",
    "Company Name": "Unik Power",
    "Stall \nModel": "Bronze - 8",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "9791599966",
    "": ""
  },
  {
    "S No": "53",
    "Company Name": "Max Green",
    "Stall \nModel": "Bronze - 9",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Padmaraj",
    "Mob Number": "9446505005",
    "": ""
  },
  {
    "S No": "54",
    "Company Name": "JEYAR",
    "Stall \nModel": "Bronze - 10",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Santhosh",
    "Mob Number": "9633817795",
    "": ""
  },
  {
    "S No": "55",
    "Company Name": "",
    "Stall \nModel": "Bronze - 11",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "56",
    "Company Name": "",
    "Stall \nModel": "Bronze - 12",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "57",
    "Company Name": "",
    "Stall \nModel": "Bronze - 13",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "58",
    "Company Name": "Adithya Innovations",
    "Stall \nModel": "Bronze - 14",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Anad",
    "Mob Number": "9747984800",
    "": ""
  },
  {
    "S No": "59",
    "Company Name": "Milan Solar",
    "Stall \nModel": "Bronze - 15",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Maneesh",
    "Mob Number": "8590952511",
    "": ""
  },
  {
    "S No": "60",
    "Company Name": "Scientific Energy",
    "Stall \nModel": "Bronze - 16",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Joshmon Vavachan",
    "Mob Number": "9447587325",
    "": ""
  },
  {
    "S No": "61",
    "Company Name": "Mod Tech",
    "Stall \nModel": "Bronze - 17",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Shiju Wargees",
    "Mob Number": "7012828353",
    "": ""
  },
  {
    "S No": "62",
    "Company Name": "Poniard",
    "Stall \nModel": "Bronze - 18",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "9961744757",
    "": ""
  },
  {
    "S No": "63",
    "Company Name": "AVS Solar",
    "Stall \nModel": "Bronze - 19",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Arun Raveendran",
    "Mob Number": "8075312493",
    "": ""
  },
  {
    "S No": "64",
    "Company Name": "High Growth",
    "Stall \nModel": "Bronze - 20",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "9446536551",
    "": ""
  },
  {
    "S No": "65",
    "Company Name": "Bodhi Solar",
    "Stall \nModel": "Bronze - 21",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Asha",
    "Mob Number": "8330069796",
    "": ""
  },
  {
    "S No": "66",
    "Company Name": "",
    "Stall \nModel": "Bronze - 22",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "67",
    "Company Name": "Rudraveena",
    "Stall \nModel": "Bronze - 23",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Deepu",
    "Mob Number": "8589096701",
    "": ""
  },
  {
    "S No": "68",
    "Company Name": "Lumion",
    "Stall \nModel": "Bronze - 24",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Nasreen",
    "Mob Number": "9605057200",
    "": ""
  },
  {
    "S No": "69",
    "Company Name": "Eco Sol Tech",
    "Stall \nModel": "Bronze - 25",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Vishnu",
    "Mob Number": "9497800905",
    "": ""
  },
  {
    "S No": "70",
    "Company Name": "B & B Associates",
    "Stall \nModel": "Bronze - 26",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Biju",
    "Mob Number": "9946022777",
    "": ""
  },
  {
    "S No": "71",
    "Company Name": "Secure Tech",
    "Stall \nModel": "Bronze - 27",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Rakesh",
    "Mob Number": "7511122231",
    "": ""
  },
  {
    "S No": "72",
    "Company Name": "A3S",
    "Stall \nModel": "Bronze - 28",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Anil",
    "Mob Number": "7356606653",
    "": ""
  },
  {
    "S No": "73",
    "Company Name": "Eco Solar",
    "Stall \nModel": "Bronze - 29",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Anu Priya",
    "Mob Number": "8590903699",
    "": ""
  },
  {
    "S No": "74",
    "Company Name": "Green Power",
    "Stall \nModel": "Bronze - 30",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Thomas",
    "Mob Number": "9037766999",
    "": ""
  },
  {
    "S No": "75",
    "Company Name": "Jeffry",
    "Stall \nModel": "Bronze - 31",
    "stall size in Meter ": "3-3",
    "Contact Pers": "jeffery",
    "Mob Number": "9745831565",
    "": ""
  },
  {
    "S No": "76",
    "Company Name": "A2Z",
    "Stall \nModel": "Bronze - 32",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Shafeeq",
    "Mob Number": "9995757574",
    "": ""
  },
  {
    "S No": "77",
    "Company Name": "Victoria",
    "Stall \nModel": "Bronze - 33",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "9539551316",
    "": ""
  },
  {
    "S No": "78",
    "Company Name": "TEVOLT EV-INFRA",
    "Stall \nModel": "Bronze - 34",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "79",
    "Company Name": "Keypower",
    "Stall \nModel": "Bronze - 35",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Arathy",
    "Mob Number": "9539672221",
    "": ""
  },
  {
    "S No": "80",
    "Company Name": "DISUN",
    "Stall \nModel": "Bronze - 36",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "6282685463",
    "": ""
  },
  {
    "S No": "81",
    "Company Name": "",
    "Stall \nModel": "Bronze - 37",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "82",
    "Company Name": "Yuka Solar",
    "Stall \nModel": "Bronze - 38",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Sathnam Kaur",
    "Mob Number": "9148449340",
    "": ""
  },
  {
    "S No": "83",
    "Company Name": "",
    "Stall \nModel": "Bronze - 39",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "84",
    "Company Name": "Trontek",
    "Stall \nModel": "Bronze - 40",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Mohit",
    "Mob Number": "7303687469",
    "": ""
  },
  {
    "S No": "85",
    "Company Name": "",
    "Stall \nModel": "Bronze - 41",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "86",
    "Company Name": "Sen Sol",
    "Stall \nModel": "Bronze - 42",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Baiju Raj",
    "Mob Number": "9447222900",
    "": ""
  },
  {
    "S No": "87",
    "Company Name": "",
    "Stall \nModel": "Bronze - 43",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "88",
    "Company Name": "Arine Solar",
    "Stall \nModel": "Bronze - 44",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Prakash",
    "Mob Number": "9895196634",
    "": ""
  },
  {
    "S No": "89",
    "Company Name": "AVANZA",
    "Stall \nModel": "Bronze - 45",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "90",
    "Company Name": "Lumicon",
    "Stall \nModel": "Bronze - 46",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Dhaneesh",
    "Mob Number": "9995802820",
    "": ""
  },
  {
    "S No": "91",
    "Company Name": "Mithra",
    "Stall \nModel": "Bronze - 47",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Jayakrishnan Pillai",
    "Mob Number": "8139888420",
    "": ""
  },
  {
    "S No": "92",
    "Company Name": "Electromotive",
    "Stall \nModel": "Bronze - 48",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Antony",
    "Mob Number": "9847117617",
    "": ""
  },
  {
    "S No": "93",
    "Company Name": "",
    "Stall \nModel": "Bronze - 49",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "94",
    "Company Name": "Electro Battery ",
    "Stall \nModel": "Bronze - 50",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Prasanth Mishra",
    "Mob Number": "9845448040",
    "": ""
  },
  {
    "S No": "95",
    "Company Name": "Electrawise",
    "Stall \nModel": "Bronze - 51",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "8848407006",
    "": ""
  },
  {
    "S No": "96",
    "Company Name": "",
    "Stall \nModel": "Bronze - 52",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "97",
    "Company Name": "Tryphase",
    "Stall \nModel": "Bronze - 53",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Nigin",
    "Mob Number": "7907616831",
    "": ""
  },
  {
    "S No": "98",
    "Company Name": "Power 4 Ever",
    "Stall \nModel": "Bronze - 54",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "9526634634",
    "": ""
  },
  {
    "S No": "99",
    "Company Name": "Surya Prabha",
    "Stall \nModel": "Bronze - 55",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "100",
    "Company Name": "",
    "Stall \nModel": "Bronze - 56",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "101",
    "Company Name": "Bank",
    "Stall \nModel": "Bronze - 57",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "102",
    "Company Name": "Bank",
    "Stall \nModel": "Bronze - 58",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "103",
    "Company Name": "Highness Solar",
    "Stall \nModel": "Bronze - 59",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Saidali",
    "Mob Number": "9544002020",
    "": ""
  },
  {
    "S No": "104",
    "Company Name": "Urja Renewable",
    "Stall \nModel": "Bronze - 60",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Manoj",
    "Mob Number": "8547811000",
    "": ""
  },
  {
    "S No": "105",
    "Company Name": "",
    "Stall \nModel": "Bronze - 61",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "106",
    "Company Name": "Brillo",
    "Stall \nModel": "Bronze - 62",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Asha",
    "Mob Number": "8330069796",
    "": ""
  },
  {
    "S No": "107",
    "Company Name": "",
    "Stall \nModel": "Bronze - 63",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "108",
    "Company Name": "AA George",
    "Stall \nModel": "Bronze - 64",
    "stall size in Meter ": "3-3",
    "Contact Pers": "AA George",
    "Mob Number": "9995293233",
    "": ""
  },
  {
    "S No": "109",
    "Company Name": "Eco Spier",
    "Stall \nModel": "Bronze - 65",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Ravathy Nair",
    "Mob Number": "9645693477",
    "": ""
  },
  {
    "S No": "110",
    "Company Name": "",
    "Stall \nModel": "Bronze - 66",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "111",
    "Company Name": "Solar Base",
    "Stall \nModel": "Bronze - 67",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "9020767673",
    "": ""
  },
  {
    "S No": "112",
    "Company Name": "",
    "Stall \nModel": "Bronze - 68",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "113",
    "Company Name": "Menon Power",
    "Stall \nModel": "Bronze - 69",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Sreelal Menon",
    "Mob Number": "9895757729",
    "": ""
  },
  {
    "S No": "114",
    "Company Name": "Electromotive",
    "Stall \nModel": "Bronze - 70",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "9995273574",
    "": ""
  },
  {
    "S No": "115",
    "Company Name": "Isotek",
    "Stall \nModel": "Bronze - 71",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Aseem",
    "Mob Number": "9995521091",
    "": ""
  },
  {
    "S No": "116",
    "Company Name": "Narrow Ray",
    "Stall \nModel": "Bronze - 72",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Sajith",
    "Mob Number": "6282407452",
    "": ""
  },
  {
    "S No": "117",
    "Company Name": "MS Innovation",
    "Stall \nModel": "Bronze - 73",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Shibu",
    "Mob Number": "9656661233",
    "": ""
  },
  {
    "S No": "118",
    "Company Name": "Urjamithra \nParassala",
    "Stall \nModel": "Bronze - 74",
    "stall size in Meter ": "3-3",
    "Contact Pers": "Anil Kumar",
    "Mob Number": "9188328137",
    "": ""
  },
  {
    "S No": "119",
    "Company Name": "",
    "Stall \nModel": "Bronze - 75",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "120",
    "Company Name": "Anz (TATA)",
    "Stall \nModel": "EV - 1",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "121",
    "Company Name": "Mahindra CBC",
    "Stall \nModel": "EV - 2",
    "stall size in Meter ": "3-3",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "122",
    "Company Name": "",
    "Stall \nModel": "EV - 3",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "123",
    "Company Name": "",
    "Stall \nModel": "EV - 4",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "124",
    "Company Name": "",
    "Stall \nModel": "EV - 5",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "125",
    "Company Name": "",
    "Stall \nModel": "EV - 6",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "126",
    "Company Name": "",
    "Stall \nModel": "EV - 7",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "127",
    "Company Name": "",
    "Stall \nModel": "EV - 8",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "128",
    "Company Name": "",
    "Stall \nModel": "EV - 9",
    "stall size in Meter ": "",
    "Contact Pers": "",
    "Mob Number": "",
    "": ""
  },
  {
    "S No": "129",
    "Company Name": "",
    "Stall \nModel": "EV - 10"
  }
];

// Helper to clean string
function cleanStr(val) {
  if (val === undefined || val === null) return "";
  return String(val).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

// Parse dimensions and area from "8-8", "14/4", "8-4", etc.
function parseDimensionsAndArea(sizeStr) {
  const cleaned = cleanStr(sizeStr);
  if (!cleaned) {
    return { dimension: "3 metres x 3 metres", area: "9 sq. metres" };
  }

  // Matches "8-8", "14/4", "12-4", "8-4", "4-4", "3-3", "5-4"
  const match = cleaned.match(/^(\d+)[-/xX](\d+)$/);
  if (match) {
    const l = parseInt(match[1], 10);
    const w = parseInt(match[2], 10);
    const area = l * w;
    return {
      dimension: `${l} metres x ${w} metres`,
      area: `${area} sq. metres`
    };
  }

  return { dimension: `${cleaned} metres`, area: "" };
}

// Parse category from Stall Model
function parseCategory(stallModel) {
  const m = cleanStr(stallModel).toLowerCase();
  if (m.includes("main sponsor")) return "Main Sponsor";
  if (m.includes("co sponsor")) return "Co-Sponsor";
  if (m.includes("platinum")) return "Platinum";
  if (m.includes("gold")) return "Gold";
  if (m.includes("silver")) return "Silver";
  if (m.includes("bronze")) return "Bronze";
  if (m.includes("ev")) return "EV Pavilion";
  return cleanStr(stallModel) || "General Exhibitor";
}

// Format Stall Number cleanly
function parseStallNo(stallModel, sNo) {
  const m = cleanStr(stallModel);
  if (!m) return sNo ? `Stall-${sNo}` : "";
  return m;
}

// Count companies to detect multiple stalls
const companyCounts = {};
rawData.forEach((r) => {
  const name = cleanStr(r["Company Name"]);
  if (name) {
    const lower = name.toLowerCase();
    companyCounts[lower] = (companyCounts[lower] || 0) + 1;
  }
});

// Process records
const companyOccurrence = {};
const confirmedExhibitors = [];
const vacantStalls = [];

rawData.forEach((r) => {
  const rawName = cleanStr(r["Company Name"]);
  const sNo = cleanStr(r["S No"]);
  const stallModel = cleanStr(r["Stall \nModel"]);
  const sizeStr = cleanStr(r["stall size in Meter "]);
  const p1 = cleanStr(r["Contact Pers"]);
  const p2 = cleanStr(r[""]);
  const contactPerson = p1 && p2 ? `${p1} / ${p2}` : (p1 || p2);
  const mobileNumber = cleanStr(r["Mob Number"]);

  // Skip row 0 if empty
  if (!sNo && !rawName && !stallModel) return;

  const { dimension, area } = parseDimensionsAndArea(sizeStr);
  const category = parseCategory(stallModel);
  const stallNo = parseStallNo(stallModel, sNo);

  if (rawName) {
    const lower = rawName.toLowerCase();
    companyOccurrence[lower] = (companyOccurrence[lower] || 0) + 1;
    const count = companyCounts[lower] || 1;
    const currentIdx = companyOccurrence[lower];

    const multiStallTag = count > 1 ? ` (Stall ${currentIdx} of ${count})` : "";
    const isMultiStall = count > 1 ? "YES" : "NO";

    confirmedExhibitors.push({
      companyName: rawName, // Keep exact name for PDF letter
      stallNo,              // Exact stall identifier e.g. "GOLD - 1", "Silver - 5"
      category,             // "Gold", "Silver", "Platinum", "Main Sponsor", etc.
      dimension,            // e.g. "8 metres x 4 metres"
      area,                 // e.g. "32 sq. metres"
      contactPerson,        // Contact person
      mobileNumber,         // Phone number
      multiStall: isMultiStall,
      multiStallNote: multiStallTag ? `Stall ${currentIdx} of ${count}` : "Single Stall",
      sNo,
    });
  } else {
    vacantStalls.push({
      sNo,
      stallNo,
      category,
      dimension,
      area,
      status: "Available / Unallocated"
    });
  }
});

console.log(`Total confirmed bookings: ${confirmedExhibitors.length}`);
console.log(`Total vacant stalls: ${vacantStalls.length}`);

// Companies with multiple stalls
const multiStallList = confirmedExhibitors.filter((x) => x.multiStall === "YES");
console.log(`Companies with multiple stalls: ${multiStallList.length}`);

// 1. Create formatted Excel workbook with multiple sheets
const wb = XLSX.utils.book_new();

// Sheet 1: Confirmed Exhibitors (Primary Data for Mail Merge)
const wsConfirmed = XLSX.utils.json_to_sheet(confirmedExhibitors);
XLSX.utils.book_append_sheet(wb, wsConfirmed, "Confirmed_Exhibitors");

// Sheet 2: Multiple Stalls Overview (easy detection)
const wsMulti = XLSX.utils.json_to_sheet(multiStallList);
XLSX.utils.book_append_sheet(wb, wsMulti, "Multi_Stall_Companies");

// Sheet 3: Vacant / Unallocated Stalls
const wsVacant = XLSX.utils.json_to_sheet(vacantStalls);
XLSX.utils.book_append_sheet(wb, wsVacant, "Vacant_Stalls");

// Save Excel file
const outExcelPath = path.resolve("public/MASTERS_EXPO_2026_Data.xlsx");
XLSX.writeFile(wb, outExcelPath);
console.log(`Saved Excel workbook to ${outExcelPath}`);

// 2. Create clean CSV matching exact PDF headings (companyName, stallNo, category, dimension, area)
const csvData = confirmedExhibitors.map((r) => ({
  companyName: r.companyName,
  stallNo: r.stallNo,
  category: r.category,
  dimension: r.dimension,
  area: r.area,
  contactPerson: r.contactPerson,
  mobileNumber: r.mobileNumber,
  multiStallNote: r.multiStallNote,
}));

const wsCsv = XLSX.utils.json_to_sheet(csvData);
const csvContent = XLSX.utils.sheet_to_csv(wsCsv);
const outCsvPath = path.resolve("public/MASTERS_EXPO_2026_Data.csv");
fs.writeFileSync(outCsvPath, csvContent, "utf8");
console.log(`Saved CSV file to ${outCsvPath}`);

// Print summary
console.log("\n--- MULTI-STALL COMPANIES DETECTED ---");
const grouped = {};
multiStallList.forEach((r) => {
  if (!grouped[r.companyName]) grouped[r.companyName] = [];
  grouped[r.companyName].push(r.stallNo);
});
Object.entries(grouped).forEach(([comp, stalls]) => {
  console.log(`- ${comp}: ${stalls.length} stalls (${stalls.join(", ")})`);
});
