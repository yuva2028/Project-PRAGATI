import re
import os

content = open(r'c:\Users\rastr\Downloads\Project-PRAGATI\full_prompt.md', 'r', encoding='utf-8').read()
blocks = re.findall(r'### (.*?)\n.*?```[a-z]*\n(.*?)```', content, re.DOTALL)

for heading, code in blocks:
    match = re.search(r'`(project/frontend/[^\s`]+)`', heading)
    if match:
        filepath = os.path.join(r'c:\Users\rastr\Downloads\Project-PRAGATI', match.group(1).replace('/', '\\'))
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)
        print(f'Wrote to {filepath}')
