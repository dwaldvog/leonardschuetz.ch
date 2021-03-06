// Dependencies
import React, { Component } from 'react';
import ProtoController from './ProtoController';
import Card from './Card';
import TodoList from './TodoList';
import LimitedInput from './LimitedInput';
import get from '../../utils/get';

class TodosController extends ProtoController {

    constructor(...args) {
        super(...args);

        this.handleDelete = this.handleDelete.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
        this.listTodos = this.listTodos.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);

        this.state = Object.assign({}, this.state, {
            title: 'Todos',
            navigation: [
                ['todos', 'Todos'],
            ],
            todos: [],
            password: '',
            needsAuthentication: true,
            addTodoValue: '',
        });
    }

    listTodos() {
        get('/todosapi', 'GET', {}, (err, res) => {
            this.setState({
                todos: JSON.parse(res).todos,
                authorized: !JSON.parse(res).reason,
            });
        });
    }

    handleDelete(index) {
        get('/todosapi/' + index, 'DELETE', {}, (err, res) => {
            this.listTodos();
        });
    }

    handleUpload(event) {
        event.preventDefault();
        event.persist();

        get('/todosapi', 'PUT', {
            payload: {
                text: event.target[0].value,
                isLink: event.target[1].checked,
            },
        }, (err, res) => {
            event.target.reset();
            this.setState({
                addTodoValue: '',
            });
            this.listTodos();
        });
    }

    componentDidMount() {
        if (this.state.authenticated) {
            this.listTodos();
        }
    }

    appGotAuthenticated() {
        this.listTodos();
    }

    handleInputChange(value) {
        this.setState({
            addTodoValue: value,
        });
    }

    content(navItems, routerParams, routerPath) {
        const todoInput = (
            <Card>
                # Add todo
                <form onSubmit={this.handleUpload}>
                    <LimitedInput
                        placeholder="Todo"
                        maxlength={200}
                        value={this.state.addTodoValue}
                        onChange={this.handleInputChange}>
                    </LimitedInput>
                    <input type="checkbox" name="todoInputIsLink"></input>
                    <label for="todoInputIsLink">Todo is a link</label>
                    <button type="submit">Add Todo</button>
                </form>
            </Card>
        );
        const todoList = (
            <Card>
                # Todos
                <TodoList
                    todos={this.state.todos}
                    oncomplete={this.handleDelete}>
                </TodoList>
            </Card>
        );

        return (
            <div>
                {todoInput}
                {todoList}
            </div>
        );
    }
}

export default TodosController;
