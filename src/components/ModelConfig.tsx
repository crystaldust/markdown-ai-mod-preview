import React from "react";
import {Collapse, TextInput, Textarea, UnstyledButton} from "@mantine/core";

const defaultUserPromptTemplate = `请阅读下面的Markdown格式的技术文档，分析每个段落的内容，并按照下面的要求和注意事项进行改写。
要求1：改写后的文字语言简洁流畅，并且不改变原意
要求2：如果原文已经满足要求1，则不需要修改
要求3：只修改文本内容，不修改任何Markdown格式
要求4：保持原有的空行数量
要求5：注意引号的使用，中文语句、词组不要使用英文双引号

改写完成后，只输出改变后的Markdown，不要输入任何其他无关内容。

以下是Markdown原文：\n`
// Setup model service host, api path, model name, prompt template, api key, etc.
export default class ModelConfig extends React.Component<any, any> {
    constructor(props: any) {
        super(props)
        this.state = {
            opened: false,
        }

        this.toggle = this.toggle.bind(this)
    }

    toggle() {
        this.setState({
            opened: !this.state.opened
        })
    }

    render() {
        return <div>
            <UnstyledButton onClick={this.toggle}>Config the model</UnstyledButton>
            <Collapse in={this.state.opened}>
                <TextInput
                    label="模型服务Host"
                    // description=""
                    placeholder="OpenAI兼容Host"
                    defaultValue="https://dashscope.aliyuncs.com/compatible-mode/v1"
                />
                <TextInput
                    label="模型服务API Key"
                    // description=""
                    placeholder="OpenAI兼容Host"
                    defaultValue="sk-xxxxx"
                />
                <TextInput
                    label="模型名称"
                    // description=""
                    placeholder="Qwen3/DeepSeek"
                    defaultValue="qwen3-235b-a22b"
                />

                <Textarea
                    label="System提示词"
                    // description=""
                    placeholder="你是一名技术文档专家/程序员/软件工程师"
                    defaultValue="你是一名技术文档专家"
                />

                <Textarea
                    label="User提示词"
                    // description=""
                    placeholder="现在有一个任务，需要你..."
                    defaultValue={defaultUserPromptTemplate}
                />
            </Collapse>
        </div>
    }

}
