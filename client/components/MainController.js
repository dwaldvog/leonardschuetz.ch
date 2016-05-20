// Dependencies
import React, { Component, PropTypes } from 'react';
import ProtoController from './ProtoController';
import get from '../../utils/get';
import Card from './Card';

// Router
import {
    Link,
    IndexLink,
} from 'react-router';

class MainController extends ProtoController {

    constructor(...args) {
        super(...args);

        this.state = Object.assign({}, this.state, {
            navigation: [
                ['blog', 'Blog'],
                ['about', 'About'],
            ],
        });
    }

    filterCards(cards, source) {
        if (source !== 'blog') return cards;
        return cards.reverse();
    }
}

export default MainController;
