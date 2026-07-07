import os
import json

# metadata.json
with open('metadata.json', 'r') as f:
    meta = json.load(f)
meta['name'] = "Network Simulator"
meta['description'] = "An advanced graph propagation simulation platform modeling cascading risk over directed networks."
with open('metadata.json', 'w') as f:
    json.dump(meta, f, indent=2)

files_to_patch = [
    "src/components/LoginPage.tsx",
    "src/components/ConfigPage.tsx",
    "src/components/SimulatorPage.tsx",
    "src/components/LearnPage.tsx",
    "src/App.tsx"
]

replacements = {
    "URSA Network Simulator": "Network Simulator",
    "URSA — Urban Resilience & Sustainability Alliance": "Network Simulator",
    "Initializing URSA Workspace": "Initializing Network Simulator Workspace",
    "Log out of URSA": "Log out of Network Simulator",
    "URSA Simulator": "Network Simulator",
    "URSA framework": "network framework",
    "URSA educational suite": "educational suite",
    "URSA model": "network model",
    "URSA structures": "default structures",
    "default URSA structures": "default network structures",
    "URSA realistic stress propagation": "realistic stress propagation",
    "URSA": "Network Simulator"
}

for filepath in files_to_patch:
    with open(filepath, "r") as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(filepath, "w") as f:
        f.write(content)
