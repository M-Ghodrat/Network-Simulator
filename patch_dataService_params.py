import re

with open("src/dataService.ts", "r") as f:
    content = f.read()

simple_params = """const SIMPLE_PARAMS: SimulatorParams = {
  ...DEFAULT_PARAMS,
  shocks: [
    { node: "N2", intensity: 0.4 },
    { node: "N10", intensity: 0.4 }
  ]
};
"""

content = content.replace("class DataService {", simple_params + "\nclass DataService {")

content = content.replace('this.params = { ...DEFAULT_PARAMS };\n    }', 'this.params = { ...SIMPLE_PARAMS };\n    }')

content = content.replace(
    'await setDoc(doc(db, "users", uid, "params", "default"), DEFAULT_PARAMS);',
    'const paramsToLoad = isAdmin ? DEFAULT_PARAMS : SIMPLE_PARAMS;\n        await setDoc(doc(db, "users", uid, "params", "default"), paramsToLoad);'
)

with open("src/dataService.ts", "w") as f:
    f.write(content)

