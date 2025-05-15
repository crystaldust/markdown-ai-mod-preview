import React from "react";
import {DiffViewWithScrollBar} from "./components/DiffViewWithScrollBar.tsx";
import {DiffModeEnum, SplitSide} from "@git-diff-view/react";
import {DiffFile, generateDiffFile} from "@git-diff-view/file";
import OpenAI from "openai";
import {modDoc, originalDoc} from './diffs.ts'
import ModelConfig from "./components/ModelConfig.tsx";
import {Button, Upload} from "antd";

// TODO Get the info from model config component
const OPENAI_API_KEY = 'YOUR_API_KEY'
const OPENAI_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const openai = new OpenAI(
    {
        apiKey: OPENAI_API_KEY,
        baseURL: OPENAI_API_URL,
        dangerouslyAllowBrowser: true,
    }
);


const getDiffFile = (oldContent: string, newContent: string) => {
    const _diffFile = generateDiffFile("temp1.md", oldContent, "temp2.md", newContent, "md", "md");

    const instance = DiffFile.createInstance({
        oldFile: {content: oldContent, fileName: "temp1.md"},
        newFile: {content: newContent, fileName: "temp2.md"},
        hunks: _diffFile._diffList,
    });

    instance.initRaw();
    return instance;
}

// const promptTemplate = "请阅读下面的Markdown格式的技术文档，分析每个段落的内容。仅在必要时对内容进行重写，使其语言简洁流畅，并且不改变原意。如果原文已经满足这些要求，则不需修改。注意，只修改文本内容，不修改任何Markdown格式，保持原有的空行数量。修改后，只输出改变后的Markdown，不要输入任何其他无关内容："
const promptTemplate = `请阅读下面的Markdown格式的技术文档，分析每个段落的内容，并按照下面的要求和注意事项进行改写。
要求1：改写后的文字语言简洁流畅，并且不改变原意
要求2：如果原文已经满足要求1，则不需要修改
要求3：只修改文本内容，不修改任何Markdown格式
要求4：保持原有的空行数量
要求5：注意引号的使用，中文语句、词组不要使用英文双引号

改写完成后，只输出改变后的Markdown，不要输入任何其他无关内容。

以下是Markdown原文：\n`

export default class App extends React.Component<any, any> {
    constructor(props: any) {
        super(props);
        const diff = getDiffFile(originalDoc, modDoc)
        this.state = {
            diffGenerated: true,
            diffFileInstance: undefined,
            str: "",
            extend: {
                oldFile: {},
                newFile: {},
            }
        }

        this.uploadDoc = this.uploadDoc.bind(this)
    }

    uploadDoc(file) {
        console.log('before upload, info:', file)
        // if (info.file.status === 'done') {
        //     console.log(info)
        // }
        if (file && file.type.startsWith('text/')) {
            const fileReader = new FileReader();
            fileReader.onload = async () => {
                const fileContent = fileReader.result
                let reasoningContent = '';
                let answerContent = '';
                let isAnswering = false;
                // TODO Handle the situations:
                //  1. Invalid API KEY
                //  2. Timeout
                //  3. 50x server error
                console.log(fileContent)
                const completion = await openai.chat.completions.create({
                    model: "qwen3-235b-a22b",  //此处以qwen-plus为例，可按需更换模型名称。模型列表：https://help.aliyun.com/zh/model-studio/getting-started/models
                    messages: [
                        {role: "system", content: "你是一名技术文档专家"},
                        {
                            role: "user", content: `${promptTemplate}\n${fileContent}`,
                        }
                    ],
                    stream: true,
                    // enable_thinking: true,
                });


                for await (const chunk of completion) {
                    if (!chunk.choices?.length) {
                        // console.log('\nUsage:');
                        // console.log(chunk.usage);
                        continue;
                    }

                    const delta = chunk.choices[0].delta;

                    // // 只收集思考内容
                    // if (delta.reasoning_content !== undefined && delta.reasoning_content !== null) {
                    //     if (!isAnswering) {
                    //         // console.log(delta.reasoning_content);
                    //     }
                    //     reasoningContent += delta.reasoning_content;
                    // }

                    // 收到content，开始进行回复
                    if (delta.content !== undefined && delta.content) {
                        if (!isAnswering) {
                            console.log('\n' + '='.repeat(20) + '完整回复' + '='.repeat(20) + '\n');
                            isAnswering = true;
                        }
                        // console.log(delta.content);
                        answerContent += delta.content;
                    }
                }
                // console.log('finally, original content is\n', fileContent)
                // console.log('finally, model output is\n', answerContent)
                const diffFileInstance = getDiffFile(fileContent, answerContent)
                this.setState({
                    diffGenerated: true,
                    diffFileInstance,
                })

            };
            fileReader.onerror = () => {
                console.error("Error reading the file. Please try again.", "error");
            };
            fileReader.readAsText(file);
        } else {
            console.error('No file or non-text file uploaded!')
        }
    }

    handleUpload(uploadInfo) {
        console.log('DEBUG', arguments)
        console.log(uploadInfo.file)
    }
    renderWidgetLine = ({side, lineNumber, onClose}) => {
        // render scope have a high level tailwind default style, next release should fix this
        return (
            <Box p="lg" className="widget border-color border-b border-t border-solid">
                <Textarea onChange={(v) => this.setState({str: v})}/>
                <Group mt="lg" justify="flex-end">
                    <Button onClick={onClose} color="gray" className="text-white" size="xs">
                        cancel
                    </Button>
                    <Button
                        onClick={() => {
                            onClose();
                            if (this.state.str) {
                                const sideKey = side === SplitSide.old ? "oldFile" : "newFile";
                                const originalExtend = this.state.extend
                                const newExtend = {...originalExtend}
                                newExtend[sideKey] = {
                                    ...originalExtend[sideKey],
                                    [lineNumber]: {data: [...(newExtend[sideKey]?.[lineNumber]?.["data"] || []), this.state.str]},
                                }
                                this.setState({
                                    extend: newExtend,
                                })
                            }
                        }}
                        className="text-white"
                        size="xs"
                    >
                        submit
                    </Button>
                </Group>
            </Box>
        );
    }

    renderExtendLine = ({data, side, lineNumber}) => {
        if (!data || !data.length) return null;
        return (
            <Box className="border-color border-b border-t border-solid" p="sm">
                <Stack>
                    {data.map((d, i) => (
                        <Card key={i} withBorder className="relative">
                            <Text>{d}</Text>
                            <CloseButton
                                className="absolute right-1 top-1"
                                size="xs"
                                onClick={() => {
                                    const sideKey = side === SplitSide.old ? "oldFile" : "newFile";
                                    const originalExtend = this.state.extend;
                                    const newExtend = {...originalExtend}
                                    const nData = newExtend[sideKey]?.[lineNumber].data.filter((_, index) => index !== i);
                                    newExtend[sideKey] = {
                                        ...originalExtend,
                                        [lineNumber]: {
                                            data: nData?.length ? nData : undefined,
                                        },
                                    }
                                    this.setState({extend: newExtend})
                                }}
                            />
                        </Card>
                    ))}
                </Stack>
            </Box>
        );
    }

    render() {
        return <div>
            <ModelConfig/>
            <Upload
                beforeUpload={this.uploadDoc}
                name="doc"
                customRequest={()=>{}}
            >
                <Button>Upload Document</Button>
            </Upload>
            {this.state.diffGenerated &&
              <DiffViewWithScrollBar
                diffFile={this.state.diffFileInstance}
                  // highlighter={shikiHighlighter}
                  // refreshDiffFile={refreshFile}
                diffViewHighlight={true}
                diffViewTheme="light"
                diffViewMode={DiffModeEnum.Split}
                diffViewWrap={true}
                diffViewAddWidget={true}
                extendData={this.state.extend}
                renderWidgetLine={this.renderWidgetLine}
                renderExtendLine={this.renderExtendLine}
                diffViewFontSize={9}
              />
            }
        </div>
    }
}
