"use client";
import { useEffect, useState, useRef } from "react";
import { useChat } from "ai/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  ChevronRight,
  UserCircle2,
  ArrowLeft,
  ArrowLeftCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function CharacterSelector({
  theme,
  onSelect,
  onNext,
  onBack,
}: {
  theme: string;
  onSelect: (personality: {
    name: string;
    description: string;
    tone: string;
  }) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [personalities, setPersonalities] = useState<
    Array<{
      name: string;
      description: string;
      tone: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [customPersonality, setCustomPersonality] = useState({
    name: "",
    description: "",
    tone: "",
  });
  const [selected, setSelected] = useState<{
    name: string;
    description: string;
    tone: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(
    null
  );
  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{ name: string; description: string; tone: string }>
  >([]);

  // 一覧表示状態を管理する状態変数を追加
  const [showList, setShowList] = useState(true);
  // チャット表示状態を明示的に管理
  const [showChat, setShowChat] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // useChat hook from AI SDK
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
  } = useChat({
    api: "/api/character-chat",
    body: {
      theme,
    },
    onFinish: (message) => {
      // Scroll to bottom when message is complete
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

      // Check if this is an AI response providing personality suggestions
      if (message.role === "assistant" && messages.length <= 2) {
        // Extract personality suggestions using regex
        const personalityRegex =
          /\*\*候補\d+:\s*(.*?)\*\*\s*-\s*説明:\s*(.*?)\s*-\s*トーン:\s*(.*?)(?=\n\n|\n\*\*|$)/gs;
        let match;
        const extractedSuggestions: Array<{
          name: string;
          description: string;
          tone: string;
        }> = [];

        let content = message.content;
        while ((match = personalityRegex.exec(content)) !== null) {
          if (match.length >= 4) {
            extractedSuggestions.push({
              name: match[1].trim(),
              description: match[2].trim(),
              tone: match[3].trim(),
            });
          }
        }

        // If we found suggestions, show them and update state
        if (extractedSuggestions.length > 0) {
          setPersonalities(extractedSuggestions);
          setLoading(false);
          setAiSuggestions(extractedSuggestions);
          setShowSuggestionModal(true);
        }
      }
    },
  });

  // メッセージが存在する場合にチャット表示状態を同期する
  useEffect(() => {
    if (messages.length > 1) {
      setShowChat(true);
    }
  }, [messages]);

  // 初回ロード時に自動的にAIにパーソナリティの提案を依頼
  useEffect(() => {
    // APIからパーソナリティの候補を取得
    const fetchCharacters = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch characters");
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPersonalities(data);
          setLoading(false);
        } else {
          // APIから取得できなかった場合は、AIに提案を依頼
          handleSubmit(new Event("submit") as any, {
            data: {
              prompt: `テーマ「${theme}」に合うポッドキャストのパーソナリティを3つ提案してください`,
            },
          });
        }
      } catch (err) {
        console.error("Error fetching characters:", err);
        // エラー時もAIに提案を依頼
        handleSubmit(new Event("submit") as any, {
          data: {
            prompt: `テーマ「${theme}」に合うポッドキャストのパーソナリティを3つ提案してください`,
          },
        });
      }
    };

    fetchCharacters();
  }, [theme]);

  // パーソナリティカードを選択したとき
  const handleSelect = (personality: {
    name: string;
    description: string;
    tone: string;
  }) => {
    setSelected(personality);
    setCustomPersonality(personality);
    onSelect(personality);
    // 選択時に詳細表示に切り替え
    setShowList(false);
    // チャット表示を閉じる
    setShowChat(false);
  };

  // カスタム入力モードで保存ボタンを押したとき
  const handleSaveCustom = () => {
    if (!customPersonality.name.trim()) return;

    const newPersonality = {
      name: customPersonality.name,
      description: customPersonality.description || "特に指定なし",
      tone: customPersonality.tone || "自然な会話調",
    };

    setSelected(newPersonality);
    onSelect(newPersonality);
    setEditMode(false);
    // 保存したら詳細表示に切り替え
    setShowList(false);
    // チャット表示を閉じる
    setShowChat(false);
  };

  // チャットで質問を送信
  const submitChatMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Look for specific keywords that indicate user wants to proceed
    const userInput = input.toLowerCase();
    const proceedKeywords = [
      "このキャラクターで",
      "これで",
      "決定",
      "次へ",
      "進む",
      "確定",
      "ok",
      "good",
      "いいね",
      "続ける",
      "採用",
      "使う",
      "決める",
      "いいと思う",
      "選ぶ",
      "セレクト",
      "オッケー",
    ];

    const wantsToChoose = proceedKeywords.some((keyword) =>
      userInput.includes(keyword)
    );

    // If the user seems to be confirming a character choice and we have a selected character
    if (selected && messages.length > 0 && wantsToChoose) {
      // Add a small delay before proceeding to make the flow feel natural
      setTimeout(() => {
        handleSubmit(e);
        setTimeout(() => onNext(), 800);
      }, 400);
    } else {
      // Regular submission
      handleSubmit(e);
    }
  };

  // チャットモードと一覧表示モードを切り替える
  const toggleChatMode = () => {
    if (showChat) {
      // チャットからカード表示に戻る
      setShowChat(false);
      if (personalities.length === 0) {
        // パーソナリティが一つもない場合は提案を求める
        setMessages([messages[0]]);
        handleSubmit(new Event("submit") as any, {
          data: {
            prompt: `テーマ「${theme}」に合うポッドキャストのパーソナリティを3つ提案してください`,
          },
        });
      }
    } else {
      // カード表示からチャットに切り替え
      setShowChat(true);
      setShowList(true); // 一覧表示に戻す
      if (messages.length <= 1) {
        handleSubmit(new Event("submit") as any, {
          data: {
            prompt: `テーマ「${theme}」に合うポッドキャストのパーソナリティについて相談したいです。どんな特徴を持つパーソナリティが良いでしょうか？`,
          },
        });
      }
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-full">
      <div className="w-full flex justify-between items-center px-4 md:px-8 py-4">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="flex items-center text-gray-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-1" size={16} />
            テーマ選択に戻る
          </button>
        </div>

        <div className="text-lg font-medium text-gray-600">
          ステップ 2/5: パーソナリティを選択
        </div>

        {selected && (
          <Button onClick={onNext} className="flex items-center" size="sm">
            次へ進む
            <ChevronRight className="ml-1" size={16} />
          </Button>
        )}
      </div>

      <h1 className="text-3xl font-serif text-center mt-6 mb-2">
        パーソナリティを選択
      </h1>
      <p className="mb-6 text-gray-500 text-center max-w-md px-4">
        テーマ「{theme}
        」のポッドキャストにふさわしい話し手の人格を選んでください。
        {!selected &&
          !editMode &&
          "既存のパーソナリティから選ぶか、チャットでAIと相談してください。"}
      </p>

      {/* パーソナリティ提案モーダル */}
      {showSuggestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-medium mb-4">
              AIからのパーソナリティ提案
            </h3>
            <p className="text-gray-600 mb-4">
              以下のパーソナリティが提案されました。選択するか、後でチャットでさらに相談できます。
            </p>
            <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
              {aiSuggestions.map((personality, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedSuggestion(index);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedSuggestion === index
                      ? "border-primary bg-primary/10"
                      : "border-gray-200 hover:border-primary/40"
                  }`}
                >
                  <h4 className="font-medium">{personality.name}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {personality.description}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => setShowSuggestionModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                後で選ぶ
              </button>
              <button
                onClick={() => {
                  if (selectedSuggestion !== null) {
                    handleSelect(aiSuggestions[selectedSuggestion]);
                    setShowSuggestionModal(false);
                  }
                }}
                disabled={selectedSuggestion === null}
                className={`px-4 py-2 rounded-lg ${
                  selectedSuggestion !== null
                    ? "bg-primary text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                このパーソナリティを選択
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 選択済みパーソナリティ表示 */}
      {selected && !editMode && !showList && !showChat && (
        <div className="w-full max-w-md mb-8 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6">
            <div className="flex items-center mb-4">
              <UserCircle2 className="text-primary h-12 w-12 mr-4" />
              <div>
                <h3 className="text-xl font-bold">{selected.name}</h3>
                <p className="text-sm text-gray-500">選択中のパーソナリティ</p>
              </div>
            </div>
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 mb-1">説明:</h4>
              <p className="text-sm text-gray-600">{selected.description}</p>
            </div>
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-1">
                トーン:
              </h4>
              <p className="text-sm text-gray-600">{selected.tone}</p>
            </div>
            <div className="flex justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditMode(true);
                  setCustomPersonality(selected);
                }}
              >
                編集
              </Button>

              {/* 一覧に戻るボタンを追加 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowList(true)}
                className="flex items-center"
              >
                <ArrowLeftCircle size={16} className="mr-1" />
                一覧に戻る
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* カスタム入力フォーム */}
      {editMode && (
        <div className="w-full max-w-md mb-8 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-bold mb-4">
              パーソナリティをカスタマイズ
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前
                </label>
                <Input
                  value={customPersonality.name}
                  onChange={(e) =>
                    setCustomPersonality({
                      ...customPersonality,
                      name: e.target.value,
                    })
                  }
                  placeholder="パーソナリティの名前"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={customPersonality.description}
                  onChange={(e) =>
                    setCustomPersonality({
                      ...customPersonality,
                      description: e.target.value,
                    })
                  }
                  placeholder="個性、背景、視点などの詳細"
                  className="w-full min-h-[80px] px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  トーン
                </label>
                <Input
                  value={customPersonality.tone}
                  onChange={(e) =>
                    setCustomPersonality({
                      ...customPersonality,
                      tone: e.target.value,
                    })
                  }
                  placeholder="話し方の特徴、使用する言葉遣いなど"
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditMode(false);
                  // 編集をキャンセルした時、選択されている場合は詳細表示に、そうでない場合は一覧表示に戻る
                  if (selected) {
                    setShowList(false);
                  } else {
                    setShowList(true);
                  }
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleSaveCustom}
                size="sm"
                disabled={!customPersonality.name.trim()}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* パーソナリティカード一覧 */}
      {(!selected || showList) && !editMode && !showChat && (
        <>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="animate-spin" />
              <span className="ml-2 text-gray-500">
                パーソナリティを生成中...
              </span>
            </div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : (
            <div className="w-full max-w-2xl mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
              {personalities.map((personality, idx) => (
                <button
                  key={idx}
                  className={`p-4 rounded-xl bg-white shadow-md flex items-start text-left transition border-2 ${
                    selected?.name === personality.name
                      ? "border-primary bg-primary/5 shadow-lg"
                      : "border-transparent hover:border-primary/40"
                  }`}
                  onClick={() => handleSelect(personality)}
                >
                  <UserCircle2 className="flex-shrink-0 text-primary h-10 w-10 mr-3 mt-1" />
                  <div>
                    <h3 className="font-bold">{personality.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                      {personality.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      トーン: {personality.tone}
                    </p>
                  </div>
                </button>
              ))}
              <button
                className="p-4 rounded-xl bg-white shadow-md border-2 border-dashed border-gray-300 hover:border-primary/40 flex flex-col items-center justify-center text-gray-500 hover:text-primary transition"
                onClick={() => {
                  setEditMode(true);
                  setCustomPersonality({ name: "", description: "", tone: "" });
                }}
              >
                <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center mb-2">
                  <span className="text-xl">+</span>
                </div>
                <span>カスタムパーソナリティを作成</span>
              </button>
            </div>
          )}

          <Button
            variant="outline"
            className="mb-4"
            onClick={() => {
              // リセットして再度提案を求める
              setMessages([messages[0]]);
              handleSubmit(new Event("submit") as any, {
                data: {
                  prompt: `テーマ「${theme}」に合う別のポッドキャストのパーソナリティを3つ提案してください`,
                },
              });
            }}
          >
            他のパーソナリティを提案してもらう
          </Button>
        </>
      )}

      {/* チャットUI */}
      {showChat && (
        <div className="w-full max-w-md flex flex-col gap-2 mb-8 rounded-xl p-4">
          {messages.slice(1).map((message) => (
            <div
              key={message.id}
              className={`whitespace-pre-wrap ${
                message.role === "user" ? "text-right" : "text-left"
              }`}
            >
              <div
                className={`inline-block px-3 py-2 rounded-2xl ${
                  message.role === "user"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-primary/10 text-primary"
                } max-w-[85%]`}
              >
                {message.role === "assistant" ? (
                  <div className="markdown prose prose-sm max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  message.content
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-left text-primary">
              <span className="inline-block px-3 py-2 rounded-2xl bg-primary/10 text-primary">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* 入力欄 - チャット時のみ表示 */}
      {showChat && (
        <div className="w-full max-w-md fixed bottom-8 left-1/2 -translate-x-1/2">
          <form
            onSubmit={submitChatMessage}
            className="flex items-center bg-gray-100 rounded-full px-4 py-2 shadow"
          >
            <Input
              className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
              placeholder="AIとパーソナリティについて相談できます"
              value={input}
              onChange={handleInputChange}
              style={{
                boxShadow: "none",
                border: "none",
              }}
            />
            <button
              type="submit"
              className="ml-2 text-gray-400 hover:text-primary transition-colors"
              aria-label="send chat"
              disabled={isLoading || !input.trim()}
            >
              💬
            </button>
          </form>

          {messages.length > 2 && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => {
                  // Show the personality creation form based on chat
                  setEditMode(true);
                  // Try to extract a personality from the conversation
                  const lastAiMessage = [...messages]
                    .reverse()
                    .find((m) => m.role === "assistant");
                  if (lastAiMessage) {
                    const content = lastAiMessage.content;
                    // Try to extract name
                    let name = "";
                    const nameMatch =
                      content.match(/名前[:：]?\s*([^\n]+)/i) ||
                      content.match(/(\S+さん)/);
                    if (nameMatch) {
                      name = nameMatch[1].trim();
                    } else {
                      name = "AIが提案したパーソナリティ";
                    }

                    // Initialize with basic info from chat
                    setCustomPersonality({
                      name: name,
                      description: content.slice(0, 100) + "...",
                      tone: "会話的で親しみやすい",
                    });
                  } else {
                    setCustomPersonality({
                      name: "",
                      description: "",
                      tone: "",
                    });
                  }
                }}
                className="text-sm text-primary hover:underline flex items-center"
              >
                チャットからパーソナリティを作成
                <svg
                  className="ml-1 w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* チャット切り替えボタン */}
      <Button
        variant={showChat ? "outline" : "default"}
        className="mt-2 mb-20" /* マージンを増やして入力欄との重なりを防ぐ */
        onClick={toggleChatMode}
      >
        {showChat ? "パーソナリティ一覧を表示" : "AIとチャットで相談する"}
      </Button>

      {/* 選択済み状態で一覧に戻るボタン（モバイル対応） */}
      {selected && !showList && !editMode && !showChat && (
        <Button
          variant="outline"
          className="mt-4 mb-20"
          onClick={() => setShowList(true)}
        >
          <ArrowLeftCircle size={16} className="mr-2" />
          パーソナリティ一覧に戻る
        </Button>
      )}
    </div>
  );
}
