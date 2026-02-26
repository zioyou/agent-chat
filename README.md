# Agent Chat UI

Agent Chat UI는 채팅 인터페이스를 통해 `messages` 키를 가진 모든 LangGraph 서버와 채팅할 수 있도록 해주는 Next.js 애플리케이션입니다.

> [!NOTE]
> 🎥 초기 설정 방법 비디오 가이드를 확인하려면 [여기](https://youtu.be/lInrwVnZ83o)를 시청하세요.

## 설정 (Setup)

```bash
cd agent-chat
```

의존성(Dependencies) 설치:

```bash
pnpm install
```

앱 실행:

```bash
pnpm dev
```

앱은 `http://localhost:3000` 에서 접속할 수 있습니다.

## 사용법 (Usage)

1. **애플리케이션 시작**: 앱이 실행되면 `http://localhost:3000` 으로 접속합니다.
2. **초기 설정 (선택 사항)**: 환경 변수(`.env`)로 설정되지 않은 경우, **Deployment URL**(배포 주소, 예: 로컬 백엔드일 경우 `http://localhost:8002`)과 **Assistant ID**(에이전트 ID, 예: `agent`)를 입력하라는 메시지가 표시됩니다.
3. **도구 자격 증명 구성 (설정)**:
   - 채팅 인터페이스 우측 하단이나 메뉴의 ⚙️ **Settings(설정)** 아이콘을 클릭합니다.
   - 외부 도구(예: 카카오 API 키, 슬랙 웹훅, 구글 OAuth 클라이언트 ID/비밀번호 등)에 대한 자격 증명을 입력합니다.
   - _참고: 이 정보들은 브라우저의 `localStorage`에 안전하게 저장되며, 특정 에이전트가 요구할 때만 전송됩니다._
4. **채팅 관리**: 좌측 사이드바의 채팅 히스토리를 이용해 과거 대화 내역을 관리할 수 있습니다. 또한 스레드를 삭제하여 워크스페이스를 깔끔하게 유지할 수 있습니다.

## 환경 변수 (Environment Variables)

다음 환경 변수를 설정하면 초기 설정 폼을 건너뛸 수 있습니다:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8002
NEXT_PUBLIC_ASSISTANT_ID=agent
```

> [!TIP]
> 프로덕션(Production) LangGraph 서버에 연결하려면 아래 [프로덕션 배포(Going to Production)](#going-to-production) 섹션을 읽어보세요.

환경 변수 사용 방법:

1. `.env.example` 파일을 복사하여 새로운 `.env` 파일을 만듭니다.
2. `.env` 파일에 필요한 값을 채웁니다.
3. 애플리케이션을 재시작합니다.

이 환경 변수들이 설정되면 애플리케이션은 설정 폼을 보여주는 대신 이 값들을 기본으로 사용합니다.

## 채팅에서 메시지 숨기기 (Hiding Messages)

Agent Chat UI 내에서 메시지의 가시성(Visibility)을 크게 두 가지 방법으로 조절할 수 있습니다:

**1. 실시간 스트리밍 방지:**

LLM 호출 도중 브라우저에 *실시간으로 메시지가 타이핑되며 나타나는 것*을 막으려면, 채팅 모델 설정에 `langsmith:nostream` 태그를 추가합니다. UI는 스트리밍 메시지를 렌더링하기 위해 일반적으로 `on_chat_model_stream` 이벤트를 이용하는데, 이 태그는 해당 모델에서 발생하는 이벤트를 가려줍니다.

_Python 예시:_

```python
from langchain_anthropic import ChatAnthropic

# .with_config 메서드를 통해 태그 추가
model = ChatAnthropic().with_config(
    config={"tags": ["langsmith:nostream"]}
)
```

_TypeScript 예시:_

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic()
  // .withConfig 메서드를 통해 태그 추가
  .withConfig({ tags: ["langsmith:nostream"] });
```

**참고:** 이렇게 스트리밍을 숨기더라도, LLM 호출이 완전히 종료된 이후 Graph 상태(State)에 메시지가 저장되었다면 화면에 표시는 됩니다.

**2. 메시지 영구 숨김 처리:**

스트리밍할 때도 안 보이고, 나중에 상태(State)에 저장된 후에도 채팅 UI에 _절대_ 노출되지 않게 하려면, Graph 상태에 메시지를 추가하기 _전에_ 해당 메시지의 `id` 값 앞에 `do-not-render-` 라는 접두사(Prefix)를 붙여주면 됩니다 (물론 `langsmith:do-not-render` 태그도 추가해야 함). UI는 ID가 이 단어로 시작하는 모든 메시지를 필터링하여 숨깁니다.

_Python 예시:_

```python
result = model.invoke([messages])
# 상태(State)에 저장하기 전에 ID에 접두사 부착
result.id = f"do-not-render-{result.id}"
return {"messages": [result]}
```

_TypeScript 예시:_

```typescript
const result = await model.invoke([messages]);
// 상태(State)에 저장하기 전에 ID에 접두사 부착
result.id = `do-not-render-${result.id}`;
return { messages: [result] };
```

이 방식을 사용하면 해당 메시지를 사용자 인터페이스에서 완벽히 차단할 수 있습니다.

## 아티팩트(Artifacts) 렌더링

Agent Chat UI는 채팅 내에 아티팩트를 렌더링하는 기능을 지원합니다. 아티팩트는 채팅화면 우측의 사이드 패널이나 알맞은 패널창에 표시됩니다. 아티팩트를 렌더링하기 위한 컨텍스트는 `thread.meta.artifact` 필드에서 가져올 수 있습니다. 참고용 유틸리티 훅 설계 예시입니다:

```tsx
export function useArtifact<TContext = Record<string, unknown>>() {
  type Component = (props: {
    children: React.ReactNode;
    title?: React.ReactNode;
  }) => React.ReactNode;

  type Context = TContext | undefined;

  type Bag = {
    open: boolean;
    setOpen: (value: boolean | ((prev: boolean) => boolean)) => void;

    context: Context;
    setContext: (value: Context | ((prev: Context) => Context)) => void;
  };

  const thread = useStreamContext<
    { messages: Message[]; ui: UIMessage[] },
    { MetaType: { artifact: [Component, Bag] } }
  >();

  return thread.meta?.artifact;
}
```

이후 `useArtifact` 훅을 통해 `Artifact` 컴포넌트를 사용하여 추가 컨텐츠를 렌더링할 수 있습니다:

```tsx
import { useArtifact } from "../utils/use-artifact";
import { LoaderIcon } from "lucide-react";

export function Writer(props: {
  title?: string;
  content?: string;
  description?: string;
}) {
  const [Artifact, { open, setOpen }] = useArtifact();

  return (
    <>
      <div
        onClick={() => setOpen(!open)}
        className="cursor-pointer rounded-lg border p-4"
      >
        <p className="font-medium">{props.title}</p>
        <p className="text-sm text-gray-500">{props.description}</p>
      </div>

      <Artifact title={props.title}>
        <p className="whitespace-pre-wrap p-4">{props.content}</p>
      </Artifact>
    </>
  );
}
```

## 프로덕션 배포 (Going to Production)

프로덕션(운영) 환경으로 넘어갈 준비가 되었다면, 배포된 LangGraph 서버로 연결하고 요청을 인증하는 방식을 손볼 필요가 있습니다. 기본적으로 이 UI는 '로컬 개발환경'에 맞춰져 클라이언트에서 서버로 직접 연결하도록 구성되어 있습니다. 하지만 운영 환경에서는 모든 사용자가 자신만의 LangSmith API 키를 넣고 LangGraph 설정을 스스로 하게 할 수는 없으므로 이 방식을 쓸 수 없습니다.

### 프로덕션 설정

운영을 위해서는 LangGraph 서버에 요청할 인증 방식을 처리할 두 가지 옵션 중 하나를 골라야 합니다:

### 빠른 시작 (Quickstart) - API Passthrough

가장 빠르게 운영 환경을 구축하는 방법은 [API Passthrough](https://github.com/bracesproul/langgraph-nextjs-api-passthrough) 패키지 ([NPM 링크](https://www.npmjs.com/package/langgraph-nextjs-api-passthrough))를 사용하는 것입니다. 이 패키지는 프록시 요청을 통해 쉽게 인증을 대신 수행해 줍니다.

이 레포지토리에는 이미 이 방법을 쓰기 위한 코드가 내장되어 있습니다. 추가적인 설정 없이, 아래와 같이 환경 변수들만 세팅해주면 됩니다.

```bash
NEXT_PUBLIC_ASSISTANT_ID="agent"
# LangGraph 서버의 실제 운영 배포 주소
LANGGRAPH_API_URL="https://my-agent.default.us.langgraph.app"
# API 프록시에 접근하기 위한 현재 여러분 웹사이트 주소 + "/api"
NEXT_PUBLIC_API_URL="https://my-website.com/api"
# LangSmith API Key (API 프록시가 내부적으로 몰래 주입해서 전송할 인증 키)
LANGSMITH_API_KEY="lsv2_..."
```

각 환경 변수의 용도:

- `NEXT_PUBLIC_ASSISTANT_ID`: 통신할 기본 Assistant ID 입니다. 클라이언트(브라우저)에서 요청을 날릴 때 필요하므로 보안 정보가 아니며 `NEXT_PUBLIC_` 이 붙습니다.
- `LANGGRAPH_API_URL`: 배포된 LangGraph 백엔드 서버의 실제 접속 URL입니다.
- `NEXT_PUBLIC_API_URL`: Next.js 서버의 URL에 `/api`를 붙인 주소입니다. 브라우저는 직접 LangGraph를 찌르지 않고 이 주소(API 프록시)를 먼저 찌르게 됩니다.
- `LANGSMITH_API_KEY`: LangGraph 서버와 인증할 때 사용되는 비밀(Secret) 키입니다. _서버 백엔드에서만 쓰여야 하므로 절대로 `NEXT_PUBLIC_` 을 앞에 붙이지 마세요!_ 프록시가 이 키를 요청에 끼워 넣어 통신합니다.

더 자세한 정보는 [LangGraph Next.js API Passthrough 문서](https://www.npmjs.com/package/langgraph-nextjs-api-passthrough)를 참고하세요.

### 고급 설정 (Advanced Setup) - 커스텀 인증 (Custom Authentication)

자체적인 커스텀 인증 방식은 다소 어렵지만 훨씬 더 견고한 운영 방식입니다. 이를 세팅하면 굳이 LangSmith API 키가 없어도 클라이언트에서의 직접 통신이 가능해지며, 사용자마다 세밀한 권한 제어 코드를 작성할 수 있습니다.

LangGraph 서버 측에 이를 세팅하는 방법은 각각 다음 공식 문서를 참조하세요: [Python](https://langchain-ai.github.io/langgraph/tutorials/auth/getting_started/), [TypeScript](https://langchain-ai.github.io/langgraphjs/how-tos/auth/custom_auth/).

백엔드 배포판에 인증 설정이 끝나고 나면, Agent Chat UI 프론트엔드에서는 다음과 같이 세팅해야 합니다:

1. 사용자가 님들의 자체적인 백엔드에서 로그인 과정을 거쳐 `Authentication Token(JWT 등)`을 발급받도록 로그인 흐름 로직을 짜야 합니다.
2. `NEXT_PUBLIC_API_URL` 환경변수에 운영 중인 LangGraph 서버 주소를 직접 할당합니다.
3. `NEXT_PUBLIC_ASSISTANT_ID` 에 사용할 Assistant ID를 할당합니다.
4. [`useTypedStream`](src/providers/Stream.tsx) (`useStream` 확장 훅) 소스코드를 열어, HTTP 헤더에 사용자의 토큰을 넘겨주도록 코드를 약간 수정합니다:

```tsx
const streamValue = useTypedStream({
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID,
  // ... 기타 속성들
  defaultHeaders: {
    Authorization: `Bearer ${addYourTokenHere}`, // 여기에 발급받은 인증 토큰을 삽입하세요.
  },
});
```
