#!/usr/bin/env python3
"""
삼항 연산자 검증 스크립트
단순 삼항은 ) : null}로, 괄호 삼항은 )}로 닫혀야 함
"""
import re
import sys

def analyze_ternary_operators(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    issues = []
    
    # 모든 ? ( 패턴 찾기
    for i, line in enumerate(lines):
        if '? (' in line and not line.strip().startswith('//'):
            if not any(x in line for x in ['if (', 'const ', 'let ', 'var ']):
                # 삼항 시작점
                start_line = i + 1
                
                # 닫는 괄호 찾기
                paren_count = line.count('(') - line.count(')')
                brace_count = 1  # {로 시작
                
                has_middle_colon = False
                close_line = None
                close_pattern = None
                
                # 다음 줄들 확인
                for j in range(i + 1, min(i + 500, len(lines))):
                    # 중간에 ) : ( 패턴 확인
                    if ') : (' in lines[j]:
                        has_middle_colon = True
                    
                    # 괄호 카운팅
                    for char in lines[j]:
                        if char == '(':
                            paren_count += 1
                        elif char == ')':
                            paren_count -= 1
                        elif char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                    
                    # 닫는 괄호 찾기
                    if ')}' in lines[j] or ') : null}' in lines[j]:
                        if paren_count == 0 and brace_count == 0:
                            close_line = j + 1
                            if ')}' in lines[j]:
                                close_pattern = ')}'
                            elif ') : null}' in lines[j]:
                                close_pattern = ') : null}'
                            
                            # 검증
                            if has_middle_colon:
                                # 괄호 삼항: )}로 닫혀야 함
                                if close_pattern != ')}':
                                    issues.append({
                                        'start': start_line,
                                        'close': close_line,
                                        'type': '괄호 삼항인데 ) : null}로 닫힘',
                                        'expected': ')}',
                                        'actual': close_pattern
                                    })
                            else:
                                # 단순 삼항: ) : null}로 닫혀야 함
                                if close_pattern != ') : null}':
                                    issues.append({
                                        'start': start_line,
                                        'close': close_line,
                                        'type': '단순 삼항인데 )}로 닫힘',
                                        'expected': ') : null}',
                                        'actual': close_pattern
                                    })
                            break
                
                if close_line is None:
                    issues.append({
                        'start': start_line,
                        'close': None,
                        'type': '닫는 괄호를 찾을 수 없음',
                        'expected': '?',
                        'actual': '?'
                    })
    
    return issues

if __name__ == '__main__':
    issues = analyze_ternary_operators('src/App.jsx')
    
    if issues:
        print(f"발견된 문제: {len(issues)}개\n")
        for issue in issues:
            print(f"{issue['start']}줄 -> {issue['close']}줄")
            print(f"  타입: {issue['type']}")
            print(f"  예상: {issue['expected']}, 실제: {issue['actual']}\n")
        sys.exit(1)
    else:
        print("✅ 문제 없음!")
        sys.exit(0)
