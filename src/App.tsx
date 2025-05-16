import React from "react";
import {DiffViewWithScrollBar} from "./components/DiffViewWithScrollBar.tsx";
import {DiffModeEnum, SplitSide} from "@git-diff-view/react";
import {DiffFile, generateDiffFile} from "@git-diff-view/file";
import OpenAI from "openai";
import {modDoc, originalDoc} from './diffs.ts'
import ModelConfig from "./components/ModelConfig.tsx";
import {Button, Card, Col, Input, Row, Upload} from "antd";


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


export default class App extends React.Component<any, any> {
    constructor(props: any) {
        super(props);
        const diff = getDiffFile(originalDoc, modDoc)
        this.state = {
            diffGenerated: true,
            diffFileInstance: diff,
            str: "",
            extend: {
                oldFile: {},
                newFile: {},
            },
            modelService: {
                systemPromptTemplate: ModelConfig.DefaultSystemPromptTemplate,
                userPromptTemplate: ModelConfig.DefaultUserPromptTemplate
            }
        }

        // this.openai = new OpenAI(
        //     {
        //         apiKey: OPENAI_API_KEY,
        //         baseURL: OPENAI_API_URL,
        //         dangerouslyAllowBrowser: true,
        //     }
        // );
        this.openai = null


        this.uploadDoc = this.uploadDoc.bind(this)
        this.onModelConfigUpdated = this.onModelConfigUpdated.bind(this)
    }

    uploadDoc(file) {
        console.log('before upload, info:', file, this.state.modelService)
        // Check the model service
        const {host, apiKey, modelName, systemPromptTemplate, userPromptTemplate} = this.state.modelService
        if (!host || !apiKey || !modelName) {
            console.log('Model service host, api key or model name not specified!')
            return
        }

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
                const completion = await this.openai.chat.completions.create({
                    model: modelName,  //此处以qwen-plus为例，可按需更换模型名称。模型列表：https://help.aliyun.com/zh/model-studio/getting-started/models
                    messages: [
                        {role: "system", content: systemPromptTemplate},
                        {
                            role: "user", content: `${userPromptTemplate}\n${fileContent}`,
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

    onModelConfigUpdated(host, apiKey, modelName, systemPromptTemplate, userPromptTemplate) {
        this.openai = new OpenAI(
            {
                apiKey: apiKey,
                baseURL: host,
                dangerouslyAllowBrowser: true,
            }
        );

        this.setState({
            modelService: {
                host,
                apiKey,
                modelName,
                systemPromptTemplate,
                userPromptTemplate,
            }
        })
    }

    renderWidgetLine = ({side, lineNumber, onClose}) => {
        // render scope have a high level tailwind default style, next release should fix this
        return (
            // <Col p="lg" className="widget border-color border-b border-t border-solid">
            <Col>
                <Row>
                    <Input.TextArea onChange={(e) => console.log(e)}/>
                </Row>
                <Row mt="lg" justify="flex-end">
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
                </Row>
            </Col>
        );
    }

    renderExtendLine = ({data, side, lineNumber}) => {
        console.log(data, side, lineNumber)
        if (!data || !data.length) return null;
        return (
            <Row className="border-color border-b border-t border-solid" p="sm">
                <Row>
                    {data.map((d, i) => (
                        <Card key={i} withBorder className="relative">
                            <div>{d}</div>
                            <Button
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
                </Row>
            </Row>
        );
    }

    render() {
        return <div>
            <ModelConfig updateHook={this.onModelConfigUpdated}/>
            <Upload
                beforeUpload={this.uploadDoc}
                name="doc"
                customRequest={() => {
                }}
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
